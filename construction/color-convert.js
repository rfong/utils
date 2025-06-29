/* Code mostly by Adam Price: https://stackoverflow.com/questions/17242144/javascript-convert-hsb-hsv-color-to-rgb-accurately/17243070#17243070
 * parameters can be:
 *   h - Object = {h:x, s:y, v:z}
 * OR 
 *   h, s, v
 *   where 0 <= h,s,v <= 1
 * If you're using degrees or radians, remember to divide the `m` out.
 *
 * @returns {r: <int>, g: <int>, b: <int>}
 *   where 0 <= r,g,b <= 255, rounded to the nearest Integer.
*/
export function HSVtoRGB(h, s, v) {
  var r, g, b, i, f, p, q, t;
  if (arguments.length === 1) {
    s = h.s, v = h.v, h = h.h;
  }
  for (const x of [h,s,v]) {
    if (x < 0 || x > 1) {
      throw new Error("HSV argument must be a float in range [0.0, 1.0]");
    }
  }
  i = Math.floor(h * 6);
  f = h * 6 - i;
  p = v * (1 - s);
  q = v * (1 - f * s);
  t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v, g = t, b = p; break;
    case 1: r = q, g = v, b = p; break;
    case 2: r = p, g = v, b = t; break;
    case 3: r = p, g = q, b = v; break;
    case 4: r = t, g = p, b = v; break;
    case 5: r = v, g = p, b = q; break;
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}
