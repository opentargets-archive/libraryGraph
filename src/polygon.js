/* global d3:true */

export { polygon, polygonDims, calcCenter };

function polygon(points) {
  // 1. Find the center
  const center = calcCenter(points);

  // 2. set the angle for each point and get the furthest points per quadrant
  let poly = setAngles(points, center);

  // 3. Refine covering points outside the polygon
  while (true) {
    const outside = points.filter((p) => !isInside(p, poly.filter((p2) => p2)));
    if (outside.length) {
      const furthest = outside.sort((p) => p.dist)[0];
      poly.push(furthest);
      poly = poly.sort((v1, v2) => v1.angle - v2.angle);
    }
    else {
      break;
    }
  }

  // 4. Return the resulting polygon
  return {
    points: poly.filter((p) => p),
    center,
  };
}

// Given a set of points, calculates the geometric center
function calcCenter(points) {
  let maxX = -Infinity,
    minX = Infinity,
    maxY = -Infinity,
    minY = Infinity;

  points.forEach((p) => {
    const x = p.x;
    const y = p.y;
    if (x < minX) {
      minX = x;
    }
    if (x > maxX) {
      maxX = x;
    }
    if (y < minY) {
      minY = y;
    }
    if (y > maxY) {
      maxY = y;
    }
  });

  const cx = minX + ~~((maxX - minX)/2);
  const cy = minY + ~~((maxY - minY)/2);

  return { x: cx, y: cy };
}

function setAngles(points, center) {
  const furthestPerQuadrant = [undefined, undefined, undefined, undefined]; // Initialised to empty
  points.forEach((p) => {
    setAngle(center, p);
    setDistance(center, p);
    // const angle = p.angle;
    const dist = p.dist;
    const quad = p.quadrant;
    if (!furthestPerQuadrant[quad]) {
      furthestPerQuadrant[quad] = p;
    }
    else if (dist > furthestPerQuadrant[quad].dist) {
      furthestPerQuadrant[quad] = p;
    }
  });

  return furthestPerQuadrant;
}

function setAngle(c, p) {
  /* eslint no-param-reassign:0 */
  let rads = Math.atan2(p.x - c.x, p.y - c.y);
  if (rads < 0) {
    rads += Math.PI * 2;
  }
  p.angle = rads * (180 / Math.PI);
  p.quadrant = Math.floor(p.angle / 90);
}

function setDistance(c, p) {
  p.dist = Math.sqrt(((p.x - c.x) * (p.x - c.x)) + ((p.y - c.y) * (p.y - c.y)));
}

function isInside(p, poly) {
  /* eslint no-plusplus: 0 */

  // ray-casting algorithm based on
  // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html

  const x = p.x;
  const y = p.y;

  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;

    // if the point p is part of the polygon return true
    if ((x === xi) && (y === yi)) {
      return true;
    }

    const intersect = ((yi > y) !== (yj > y)) && (x < (((xj - xi) * (y - yi)) / (yj - yi)) + xi);
    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

function polygonDims(poly, t) {
  const xExtent = d3.extent(poly, (d) => d.x);
  const yExtent = d3.extent(poly, (d) => d.y);
  return {
    width: t.applyX(xExtent[1]) - t.applyX(xExtent[0]),
    height: t.applyY(yExtent[1]) - t.applyY(yExtent[0]),
  };
}
