/* Simple DOM management */

function onReady(fn) {
  // see if DOM is already available
  if (document.readyState === "complete" || document.readyState === "interactive") {
    // call on next available tick
    setTimeout(fn, 1);
  } else {
    document.addEventListener("DOMContentLoaded", fn);
  }
}

function getEl(id) {
  // Get element with id=`id`.
  return document.getElementById(id);
}
function getVal(id) {
  // Get value from element with id=`id`.
  return document.getElementById(id).value;
}

function clearErrors() {
  getEl("errors").innerHTML = "";
}
function addError(msg) {
  getEl("errors").innerHTML += `<div>${msg}</div>`;
}

/* Parsing & validation */

function getAndValidateInputs() {
  clearErrors();
  let lumberLen = getVal("input-lumber-len");
  lumberLen = lumberLen.includes(".") ? undefined : parseInt(lumberLen);
  let lumberMargin = parseFloat(getVal("input-lumber-margin"));
  let cutWidth = parseFloat(getVal("input-cut-width"));

  // Validate len
  if (isNaN(lumberLen) || lumberLen <= 0) {
    addError("Lumber length must be a positive integer.");
    return false;
  }

  // Validate error margin and cut width
  if (isNaN(lumberMargin) || lumberMargin < 0) {
    addError("Lumber error margin must be a non-negative number.");
    return false;
  }
  if (isNaN(cutWidth) || cutWidth <= 0) {
    addError("Blade width must be a positive number.");
    return false;
  }
  if (lumberMargin < cutWidth) {
    addError("Lumber error margin cannot be less than blade width.");
    return false;
  }

  // Convert lumber len to inches.
  lumberLen = lumberLen * 12;
  // For effective lumber length, subtract error margin, less one blade width 
  // to compensate for the cuts all being padded with blade width already.
  let effectiveLumberLen = lumberLen - (lumberMargin - cutWidth);

  // Parse & validate cuts
  let cuts = parseCuts(cutWidth, effectiveLumberLen);
  if (cuts === undefined) {
    return false;
  }

  return {
    lumberLen: lumberLen,
    effectiveLumberLen: effectiveLumberLen,
    cutWidth: cutWidth,
    lumberMargin: lumberMargin,
    // Cuts are padded with blade width.
    cuts: cuts,
  };
}

function parseCuts(cutWidth, effectiveLumberLen) {
  let lines = getVal("input-cuts").split("\n");
  let cuts = {false: []};
  for (const line of lines) {
    let key = false,
        val = line;

    // Check for duplicate part names
    if (line.split(":").length == 2) {
      [key,val] = line.split(":");
      if (key in cuts) {
        addError(`Part names should not repeat: '${key}'`);
        return undefined;
      }
    }

    // Validate the sublist
    let subl = parseCutsSublist(val);
    if (subl === undefined) {
      return undefined;
    }
    // Pad all values with the cut width
    subl = subl.map((v) => { return v + cutWidth; });
    // Sanity check that no values are longer than the lumber itself
    if (Math.max.apply(null, subl) > effectiveLumberLen) {
      addError(`Cuts cannot be longer than the lumber itself (accounting for error margins)`);
      return undefined;
    }

    // If no part name, append to the key=false sublist
    if (key === false) {
      cuts[key] = cuts[key].concat(subl);
    // Otherwise, set new key:value pair
    } else {
      cuts[key] = subl;
    }

  }
  return cuts;
}

function compareNumbers(a,b) {
  return a-b;
}

function sortDesc(myList) {
  return myList.sort(compareNumbers).reverse();
}

function parseCutsSublist(sublistText) {
  if (sublistText.split(",").length == 0) {
    addError(`A part cannot have no values`);
    return undefined;
  }
  let sublist = sublistText.split(",").map((s) => { 
    return parseFloat(s.trim());
  });
  for (const f of sublist) {
    if (isNaN(f) || f<=0) {
      addError(`All cuts should be positive numbers`);
      return undefined;
    }
  }
  return sublist;
}

/* Algorithms! */

// Define a Cut class to keep track of which cut belongs to which part.
class Cut {
  constructor(value, partName) {
    this.value = value;
    this.partName = partName;
  }
}
function sortCutsDesc(cuts) {
  return cuts.sort((a,b) => a.value - b.value).reverse();
}

function naiveSolve(inputs) {
  /* This algorithm ignores the requested part groupings.
   *
   * This is better for saving money, but less convenient in practice for
   * physically tracking which pieces of lumber go with which parts you are 
   * currently assembling.
   */
  let partNames = Object.keys(inputs.cuts);
  let values = partNames.map(
    (key) => inputs.cuts[key].map((val) => new Cut(val, key))
  );
  let flattenedVals = (
    sortDesc(values.reduce((a,b) => a.concat(b)))
  );

  let solution = solveCuts(flattenedVals, inputs.effectiveLumberLen);

  // Display solution
  displaySolution(
    "Solution that ignores part groupings",
    "This minimizes total lumber, but it's more annoying to physically track the parts:",
    solution,
    inputs,
  );
  
  return solution;
}

function solveCuts(cuts, lumberLen, bins) {
  /* Bin pack a single list of Cuts, trying to minimize the number of bins.
   * `bins` is an optional parameter and may be used to find incremental 
   * solutions.
   */
  
  // Each bin is a collection of Cuts on a piece of lumber.
  bins = bins ?? [[]];
  function getBinRemainder(bin) {
    return lumberLen - sumCutList(bin);
  }

  // Sort cuts in descending order.
  cuts = sortCutsDesc(cuts);
  // Loop over all cuts.
  for (const nextCut of cuts) {
    // Sanity check types
    if (!(nextCut instanceof Cut)) {
      throw new Error("Expected instance of Cut");
    }

    // Find the bin that the next cut fills best. In other words, the 
    // most-full bin that still has enough space to accommodate this cut.

    // First, check the remainder left on the existing pieces of lumber.
    let remainders = (
      bins
      .map(getBinRemainder)
      .filter((val) => (val >= nextCut.value))
    );

    // If none have enough space, start a new piece.
    if (remainders.length == 0) {
      bins.push([nextCut]);
      continue;
    }

    // Otherwise, use the piece with the smallest usable remainder.
    let minUsableRemainder = Math.min.apply(null, remainders);
    for (const i in bins) {
      if (getBinRemainder(bins[i]) == minUsableRemainder) {
        bins[i].push(nextCut);
      }
    }

  }
  return bins;
}

function groupedSolve(inputs) {
  /* This algorithm prioritizes grouping cuts from the same part onto the same 
   * lumber, when possible.
   *
   * Less cost-effective, but easier to physically keep track of assembly.
   */
  let lumberLen = inputs.effectiveLumberLen;

  // Each bin is a collection of Cuts on a piece of lumber.
  let bins = [];
  function getBinRemainder(bin) {
    return lumberLen - sumCutList(bin);
  }

  // Loop over named parts, solving them separately first. 
  // (Ignore the miscellaneous bucket for now.)
  for (const partName in inputs.cuts) {
    if (partName == 'false') {  // apparently this gets coerced to string
      continue;
    }

    var subSoln = solveCuts(
      inputs.cuts[partName].map((val) => new Cut(val, partName)),
      lumberLen,
    );
    console.log(partName, inputs.cuts[partName], subSoln);
    bins = bins.concat(subSoln);
  }

  // TODO: If any bins can be trivially combined together, do that.

  // Cram in the miscellaneous pieces wherever they will fit.
  bins = solveCuts(
    inputs.cuts["false"].map((val) => new Cut(val, "false")),
    lumberLen,
    bins,
  );

  // Display the solution.
  displaySolution(
    "Solution that prioritizes part groupings",
    "Easier to physically keep track of assembly, but less cost-effective (unless you get lucky).",
    bins,
    inputs,
  );
}

function sumList(myList) {
  return myList == [] ? 0 : myList.reduce((a,b) => a+b, 0);
}

function sumCutList(cutList) {
  return sumList(cutList.map((cut) => cut.value));
}

/* Solution formatting */

function displaySolution(title, description, bins, inputs) {
  // Format HTML.
  getEl("output").innerHTML += (
    `<h3>${title} (${bins.length} pieces)</h3>` +
    description +
    `<ul>` +
    bins.map((sublist) => (
      `<li>${sublist.map((cut) => formatCut(cut, inputs.colors, inputs.cutWidth)).join(", ")} ` + 
      `(${inputs.lumberLen - sumCutList(sublist)}" left over)</li>`
    )).join("") +
    `</ul>`
  );
}

function formatCut(cut, colors, cutWidth) {
  /* Format a Cut for HTML output, colored to indicate its part. */
  return `<span style="color:${colors[cut.partName]}">${cut.value - cutWidth}"</span>`;
}

/* Setup function on document ready */

onReady(() => {
  document.getElementById("submit-button").addEventListener("click", () => {
    // Clear output
    getEl("output").innerHTML = "";

    // Get inputs
    let inputs = getAndValidateInputs();
    if (inputs === undefined) { return; }

    // Pick colors for each part
    // Test placeholder. TODO actually generate colors based on inputs.
    inputs.colors = {
      false: '#666',
      part1: '#0f6',
      part2: '#60f',
    };
    // TODO Display color legend

    // Run solvers
    groupedSolve(inputs);
    naiveSolve(inputs);

  });

  console.log("hello")
});
