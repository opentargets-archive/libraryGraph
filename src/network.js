/* global d3:true */

import apijs from 'tnt.api';

// import {getData, highlightCluster, toggleTerminals} from './data.js';
import { getQuery, setInteractors, processTopics, processLinks, linksForNodes } from './data';
import { polygon, polygonDims, calcCenter } from './polygon';


// polygon([{ x: 100, y: 50 }, { x: 24, y: 88 }, { x: 8, y: 134 }, { x: 23, y: 90 }, { x: 90, y: 90 }, { x: 50, y: 130 }]);
// polygon([{x:20,y:40},{x:10,y:20},{x:40,y:30}]);

let force;
// let link;
// let node;
let canvas;
let context;
let zoom;
let transform = d3.zoomIdentity;
let linkWeightScale;
let nodeWeightScale;
const selected = new Map();
const clicked = new Map();

const config = {
  colors: {}, // expect
  fields: {},
  // collapseSingletons: true,
  query: 'IL33 AND asthma',
  data: {},
  width: 800,
  height: 800,
  nodeSize: 30,
  maxNodeSize: 30,
  minNodeSize: 5,
  // colorScale: d3.scaleLinear()
  //   .range([d3.rgb('#007AFF'), d3.rgb('#FFF500')]), // The domain is set dynamically
};

const dispatch = d3.dispatch('click', 'dblclick', 'mouseover', 'mouseout', 'loaded', 'failed', 'selected', 'unselected', 'topicSelected', 'topicUnselected');

export default function () {
  const render = function (container) {
    // Remove all previously clicked or selected vertices
    selected.clear();
    clicked.clear();
    transform = d3.zoomIdentity;

    getQuery(config.query)
      .then((resp) => {
        console.log(resp);

        const graph = resp.data.graph;

        // If there is no graph, just fire the 'failed' event
        if (!graph.vertices.length || resp.status !== 200) {
          dispatch.call('failed');
          return;
        }

        setInteractors(graph.vertices, graph.connections);
        const topics = processTopics(graph.vertices, resp.data.topics);

        // links contain in- and out- links
        const links = processLinks(graph.vertices, graph.connections, resp.data.topics);

        // Remove singleton nodes
        graph.vertices = graph.vertices.filter((d) => d.interactors && d.interactors.length);

        config.data.nodes = graph.vertices;
        // config.data.links = [...links.in, ...links.out];
        config.data.links = links;
        config.data.topics = topics;

        getInitialPositions();

        createForce(container, config);
        dispatch.call('loaded', this, {
          graph,
          topics,
        });
      })
      .catch((err) => {
        console.trace(err.message);
      });
  };

  apijs(render).getset(config);


  // function toggleTerminals() {
  //   config.data = toggleTerminals();
  //   return this;
  // }
  //
  // api.method('toggleTerminals', toggleTerminals);

  // render.update = update;
  // render.highlightCluster = highlightCluster;

  // return d3.rebind(render, dispatch, "on");
  render.on = function () {
    /* eslint prefer-spread: 0 */
    /* eslint prefer-rest-params: 0 */
    const value = dispatch.on.apply(dispatch, arguments);
    return value === dispatch ? render : value;
  };

  render.select = programmaticClick;
  render.unselect = (d) => {
    unselectNode(d);
    redraw();
  };
  render.clickTopic = clickTopic;
  render.getVertexByTerm = getVertexByTerm;

  return render;
}

function getInitialPositions() {
  const vertices = config.data.nodes;
  const topics = config.data.topics;
  const dimBuckets = 1 + ~~Math.sqrt(topics.length);
  vertices.forEach((d) => {
    const row = Math.floor((d.topic) / dimBuckets);
    const pos = (d.topic) % dimBuckets;
    const x = (~~(config.width / dimBuckets)) * pos;
    const y = (~~(config.height / dimBuckets)) * row;
    d.x = x;
    d.y = y;
  });
}

// function highlightCluster(n) {
//   if (n) {
//     config.data = highlightCluster(n.id);
//   }
//   else {
//     config.data = highlightCluster();
//   }
//   return this;
// }

// function update() {
//
//   link = link
//     .data(force.links(), (d) => `${d.source.id}-${d.target.id}`);
//   link.exit()
//     .remove();
//   link
//     .enter().append('line')
//     .attr('stroke-width', () => 1)
//     .style({ stroke: 'gray' });
//
//
//   node = node
//     .data(force.nodes(), (d) => d.id);
//
//   node.exit()
//     .remove();
//   node
//     .enter()
//     .append('circle')
//     .each(() => {
//       console.log('new node created');
//     })
//     .attr('cx', (d) => d.x)
//     .attr('cy', (d) => d.y)
//     .attr('r', config.nodeSize)
//     .style('stroke', 'black')
//     .style('fill', (d) => {
//       if (d.type === 'disease') return 'yellow';
//       if (d.type === 'omnipathdb') return 'orange';
//       if (d.type === 'terminal') return 'lightgrey';
//       return 'green';
//     })
//
//     .call(force.drag)
//     .on('mousedown', () => d3.event.stopPropagation())
//     .on('click', function (d, i) {
//       if (d3.event.defaultPrevented) {
//         return;
//       }
//       dispatch.click.call(this, d, i);
//     });
//
//   node
//     .style('opacity', (d) => {
//       if (d.visible) {
//         return 1;
//       }
//       return 0.1;
//     });
//
//
//   force.start();
// }

function getLinkWeightExtent(conf) {
  const links = conf.data.links.in;
  const extent = d3.extent(links, (d) => d.weight);
  return d3.scaleLinear()
    .domain(extent)
    .range([1, conf.nodeSize * 0.7]);
}

function getNodeWeightExtent(conf) {
  const nodes = conf.data.nodes;
  const extent = d3.extent(nodes, (d) => d.weight);
  return d3.scaleLinear()
    .domain(extent)
    .range([conf.minNodeSize, conf.maxNodeSize]);
}

function getNodeKey(subject) {
  return `${subject.field}-${subject.term}`;
}


function getVertexByTerm(term) {
  for (let i = 0; i < config.data.nodes.length; i += 1) {
    const node = config.data.nodes[i];
    if (node.term === term) {
      return node;
    }
  }
}

function clickTopic(topic) {

  // Zoom on the vertex
  zoomOnNodes(topic.vertices);

  // // Look if the topic is selected
  // const topicVertex = config.data.nodes[topic.id];
  // const key = getNodeKey(topicVertex);
  //
  // // Unselection
  // if (selected.has(key)) {
  //   selected.clear();
  //   topic.vertices.forEach((v) => v.selected = 0);
  //   dispatch.call('topicUnselected', this, topic);
  // }
  // // Selection
  // else {
  //   // Unselect anything previously selected
  //   selected.clear();
  //   config.data.nodes.forEach((v) => {
  //     v.selected = 0;
  //   });
  //
  //   // Select the vertices of the topic
  //   // const topicVertex = config.data.nodes[topic.id]
  //   selected.set(key, topicVertex);
  //   topic.vertices.forEach((v) => {
  //     v.selected = 1;
  //   });
  //   dispatch.call('topicSelected', this, topic);
  // }
  //
  // redraw();
}

function programmaticClick(subject) {
  const k = getNodeKey(subject);
  if (clicked.has(k)) {
    unselectNode(subject);
    dispatch.call('unselected', this, {
      subject,
      // selected: Array.from(selected.values()),
      selected: Array.from(clicked.values()),
    });
  }
  else {
    selectNode(subject);
    dispatch.call('selected', this, {
      subject,
      // selected: Array.from(selected.values()),
      selected: Array.from(clicked.values()),
    });
  }

  redraw();
}

function unselectNode(uNode) {
  uNode.clicked = 0;
  uNode.selected -= 1;
  uNode.interactors.forEach((iNode) => {
    iNode.selected -= 1;
  });

  // Keep global track of selected nodes
  const key = getNodeKey(uNode);
  selected.delete(key);
  clicked.delete(key);

  // If there are selected nodes, zoom on them
  let selectedNodes = [];
  if (selected.size) {
    config.data.nodes.forEach((d) => {
      if (d.selected > 0) {
        selectedNodes.push(d);
      }
    });
  }
  else {
    selectedNodes = config.data.nodes;
  }

  zoomOnNodes(selectedNodes);
}

function selectNode(sNode) {
  /* eslint no-param-reassign: 0 */
  // unselectAll();

  /**
   * The goal is to increment the "selected" field of each vertex (node)
   * only *once* for each click
   */
  sNode.clicked = 1;
  sNode.selected += 1;
  sNode.interactors.forEach((iNode) => {
    iNode.selected += 1;
  });

  // add selected node to global selected dict
  const key = getNodeKey(sNode);
  selected.set(key, sNode);
  clicked.set(key, sNode);

  // If there are selected nodes, zoom on them
  let selectedNodes = [];
  if (selected.size) {
    config.data.nodes.forEach((d) => {
      if (d.selected > 0) {
        selectedNodes.push(d);
      }
    });
  }
  else {
    selectedNodes = config.data.nodes;
  }

  zoomOnNodes(selectedNodes);
}

function drawTopic(topic) {
  const topicPoints = topic.vertices;
  // const topicPoly = topic.polygon;

  let farAway = true;

  // The topics are not drawn while positioning the nodes
  // They are drawn only at the end, but should be included here to follow dragged nodes
  // if (topicPoly && topicPoints.length >= 3) {
  // if (selected.size) {
  //   return;
  // }
  const { points: topicPoly, center: topicCenter } = polygon(topicPoints);
  // If we are too far (zoomed out), the topic is just the the polygon
  const { width: polyWidth, height: polyHeight } = polygonDims(topicPoly, transform);
  if ((config.width < polyWidth * 3) || (config.height < polyHeight * 3)) {
    farAway = false;

    // Plot nodes
    // const nodeLinks = linksForNodes(topicPoints);
    // nodeLinks.forEach(drawLink);

    // Plot links
    // topicPoints.forEach(drawNode);
  }

  context.beginPath();
  context.fillStyle = topic.color;
  context.strokeStyle = topic.color;
  context.globalAlpha = 0.1;
  context.moveTo(topicPoly[0].x, topicPoly[0].y);
  for (let i = 1; i < topicPoly.length; i += 1) {
    context.lineTo(topicPoly[i].x, topicPoly[i].y);
  }
  context.closePath();
  context.fill();

  // draw links
  const nodeLinks = linksForNodes(topicPoints);
  nodeLinks.forEach((d) => {
    drawLink(d, farAway);
  });
  // draw nodes
  topicPoints.forEach((d) => {
    drawNode(d, farAway);
  });

  if (farAway) {
    // draw the label of the topic
    context.font = '30px Arial';
    context.textAlign = 'center';
    context.globalAlpha = 1;
    context.fillText(topic.name, topicCenter.x, topicCenter.y);
  }
}

// function drawTopic(topic) {
//   const topicPoints = topic.vertices;
//   if (topicPoints.length > 3) {
//     const topicPoly = polygon (topicPoints);
//     const topicId = topicPoly[0].topic;
//
//     context.beginPath();
//     context.fillStyle = topicId < 10 ? topicColor[topicId] : '#dddddd';
//     context.strokeStyle = topicId < 10 ? topicColor[topicId] : '#dddddd';
//     context.globalAlpha = 0.3;
//
//     // move to the first point
//     context.moveTo(topicPoly[0].x, topicPoly[0].y);
//
//
//     let i;
//     for (i = 1; i < topicPoly.length - 2; i += 1) {
//       const xc = (topicPoly[i].x + topicPoly[i + 1].x) / 2;
//       const yc = (topicPoly[i].y + topicPoly[i + 1].y) / 2;
//       context.quadraticCurveTo(topicPoly[i].x, topicPoly[i].y, xc, yc);
//     }
//     // curve through the last two points
//     context.quadraticCurveTo(topicPoly[i].x, topicPoly[i].y, topicPoly[i + 1].x, topicPoly[i + 1].y);
//     context.closePath();
//     context.fill();
//   }
// }

// function drawTopic(topic) {
//   let maxX = -Infinity,
//     minX = Infinity,
//     maxY = -Infinity,
//     minY = Infinity;
//
//   topic.vertices.forEach((v) => {
//     const n = config.data.nodes[v];
//     const x = n.x;
//     const y = n.y;
//     if (x < minX) {
//       minX = x;
//     }
//     if (x > maxX) {
//       maxX = x;
//     }
//     if (y < minY) {
//       minY = y;
//     }
//     if (y > maxY) {
//       maxY = y;
//     }
//   });
//
//   console.log(`minX: ${minX}, maxX: ${maxX}, minY: ${minY}, maxY: ${maxY}`);
//   context.beginPath();
//   context.strokeStyle = 'red';
//   // context.moveTo(minX + ~~((maxX - minX) / 2), minY + ~~((maxY - minX) / 2));
//   context.fillStyle = 'red';
//   context.globalAlpha = 0.1;
//   context.fillRect(minX, minY, (maxX - minX), (maxY - minY));
//   context.stroke();
// }

function drawLink(d, farAway) {
  context.beginPath();
  context.strokeStyle = '#8da0cb';

  // To draw the link:
  // Source and target have to be in the same topic
  // OR
  // Source or target have to be selected
  if ((!d.source.clicked && !d.target.clicked) && (d.source.topic !== d.target.topic)) {
    return;
  }

  if ((d.source.selected > 0) && (d.target.selected > 0)) {
    context.globalAlpha = 1;
  }
  else {
    if (selected.size || farAway) {
      context.globalAlpha = 0.05;
    }
    else {
      context.globalAlpha = 0.5;
    }
  }

  // if (farAway) {
  //   context.globalAlpha = 0.05;
  // }
  // else {
  //   if (selected.size === 0) {
  //     context.globalAlpha = 0.5;
  //   }
  //   else {
  //     if ((d.source.selected > 0) && (d.target.selected > 0)) {
  //       context.globalAlpha = 0.5;
  //     }
  //     else {
  //       context.globalAlpha = 0.05;
  //     }
  //   }
  // }
  // if (d.type === 'out') {
  //   context.globalAlpha = 0.05;
  // }
  context.moveTo(d.source.x, d.source.y);
  // context.lineWidth = linkWeightScale(d.weight);
  context.lineWidth = 2;
  context.lineTo(d.target.x, d.target.y);
  context.stroke();
  context.globalAlpha = 1;
}

function drawNode(d, farAway) {
  const nodeSize = nodeWeightScale(d.weight);

  // Node
  context.beginPath();
  context.moveTo(d.x, d.y);
  // context.fillStyle = config.colors[d.field];
  context.fillStyle = d.color;

  if (d.selected > 0) {
    context.globalAlpha = 1;
  }
  else {
    if (selected.size || farAway) {
      context.globalAlpha = 0.05;
    }
    else {
      context.globalAlpha = 0.5;
    }
  }

  // if (farAway) {
  //   context.globalAlpha = 0.05;
  // }
  // else {
  //   if (selected.size === 0) {
  //     context.globalAlpha = 0.5;
  //   }
  //   else {
  //     if (d.selected > 0) {
  //       context.globalAlpha = 0.8;
  //     }
  //     else {
  //       context.globalAlpha = 0.05;
  //     }
  //   }
  // }
  d.radius = nodeSize;
  context.arc(d.x, d.y, nodeSize, 0, 2 * Math.PI);
  context.fill();

  // external circle
  if (d.clicked > 0) {
    context.beginPath();
    context.globalAlpha = 1;
    context.arc(d.x, d.y, nodeSize + 5, 0, 2 * Math.PI);
    // context.strokeStyle = config.colors[d.field];
    context.strokeStyle = d.color;
    context.stroke();
  }

  // else if (d.selected > 0) {
  //   context.beginPath();
  //   context.globalAlpha = 0.5;
  //   context.arc(d.x, d.y, nodeSize + 1, 0, 2 * Math.PI);
  //   context.strokeStyle = config.colors[d.field];
  //   context.stroke();
  // }

  // label
  if (!farAway) {
    if (selected.size === 0) {
      context.globalAlpha = 1;
    }
    else {
      if (d.selected > 0) {
        context.globalAlpha = 1;
      }
      else {
        context.globalAlpha = 0;
      }
    }
    context.font = '9px Arial';
    context.textAlign = 'center';
    context.fillStyle = 'black';
    context.fillText(d.term, d.x, d.y + (nodeSize + 12));
  }
}

function redraw() {
  const data = config.data;
  context.clearRect(0, 0, config.width, config.height);
  context.save();

  context.translate(transform.x, transform.y);
  context.scale(transform.k, transform.k);

  // Draw out links
  // data.links.out.forEach(drawLink);

  // Draw topics
  data.topics.forEach(drawTopic);

  // Draw in links
  // data.links.in.forEach(drawLink);

  // Draw nodes
  // data.nodes.forEach(drawNode);

  context.restore();
}

// Focus on topic will receive all the points for a topic
// and focus the zoom level on that topic
function zoomOnNodes(nodes) {
  const centerAbs = calcCenter(nodes);
  // const center = {
  //   x: (centerAbs.x - (conf.width / 2)),
  //   y: (centerAbs.y - (conf.height / 2)),
  // };

  const xExtent = d3.extent(nodes, (d) => d.x);
  const yExtent = d3.extent(nodes, (d) => d.y);
  const width = xExtent[1] - xExtent[0];
  const height = yExtent[1] - yExtent[0];
  const newScale = d3.min([(config.width / width), (config.height / height)]);

  canvas
    .transition()
    .duration(1500)
    .call(zoom.transform,
      // transform
      d3.zoomIdentity
        .translate(config.width / 2, config.height / 2)
        .scale(newScale * 0.9)
        .translate(-centerAbs.x, -centerAbs.y)
    );
}

function createForce(container, conf) {
  const meter = d3.select(container)
    .append('div')
    .attr('class', 'interactions-network-progress')
    .node();

  linkWeightScale = getLinkWeightExtent(conf);
  nodeWeightScale = getNodeWeightExtent(conf);

  canvas = d3.select(container)
    .append('canvas')
    .attr('width', conf.width)
    .attr('height', conf.height);
  // .call(d3.zoom().scaleExtent([0.5, 8]).on("zoom", zoom));

  context = canvas.node().getContext('2d');

  // let color = d3.scaleOrdinal(d3.schemeCategory20);
  // let color = "#aa5566";

  const data = conf.data;

  // Initialise the all the nodes in a sensible place
  // data.nodes[0].x = ~~conf.width / 3;
  // data.nodes[0].y = conf.height / 2;
  // data.nodes[1].x = ~~(conf.width - (conf.width / 3));
  // data.nodes[1].y = ~~conf.height / 2;
  // for (let k = 2; k < data.nodes.length; k += 1) {
  //   data.nodes[k].x = ~~conf.width / 2;
  //   data.nodes[k].y = ~~conf.height / 2;
  // }

  force = d3.forceSimulation(data.nodes)
    // .force('links', d3.forceLink(data.links).strength(1).distance(300).iterations(1))
    // .force('charge', d3.forceManyBody().strength(-10))
    .force('charge', d3.forceManyBody().strength(1))
    .force('center', d3.forceCenter().x(conf.width / 2).y(conf.height / 2))
    .force('collision', d3.forceCollide().radius(conf.maxNodeSize))
    // .force('links', d3.forceLink(data.links))
    .force('links', d3.forceLink(data.links.in))
    .stop();

  // .on("tick", ticked)
  // .on("end", ended);

  zoom = d3.zoom()
    .on('zoom', zoomed);

  canvas
    // .call(showAll)
    .call(d3.drag()
      .container(canvas.node())
      .subject(dragsubject)
      // .on('start', clicked)
      .on('drag', dragged),
    )
    .on('click', clicked)
    .call(zoom);

  // Ticks
  const n = Math.ceil(Math.log(force.alphaMin()) / Math.log(1 - force.alphaDecay()));
  for (let i = 1; i <= n; i += 1) {
    force.tick();
  }

  // setTimeout(() => {
  //   console.log('zooming to topic...');
  //   console.log(data.topics[0]);
  //   zoomOnNodes(data.topics[0].vertices);
  // }, 3000);

  // And clear the progressing bar
  ticked();
  ended();

  function ticked() {
    const progress = 1 - force.alpha();
    meter.style.width = `${100 * progress}%`;
    redraw();
  }

  function ended() {
    meter.style.display = 'none';

    // Simulation finished... Calculate the center of the graph, the total width and height
    zoomOnNodes(data.nodes);


    // Calculate all the polygons
    // config.data.topics.forEach((t) => {
    //   t.polygon = polygon(t.vertices);
    // });
    // data.topics.forEach(drawTopic);
  }

  function dragsubject() {
    /* eslint consistent-return: 0 */
    const x = transform.invertX(d3.event.x);
    const y = transform.invertY(d3.event.y);
    const thisNode = force.find(x, y, conf.maxNodeSize);

    if (!thisNode) {
      return;
    }

    // Make sure that the node is within the radius of the found node
    const dist = Math.sqrt(((thisNode.x - x) * (thisNode.x - x)) + ((thisNode.y - y) * (thisNode.y - y)));
    if (dist > thisNode.radius) {
      return;
    }

    thisNode.x = transform.applyX(thisNode.x);
    thisNode.y = transform.applyY(thisNode.y);
    return thisNode;
  }


  // function dragstarted() {
  //   // if (!d3.event.active) force.alphaTarget(0.3).restart();
  //   d3.event.subject.fx = d3.event.subject.x;
  //   d3.event.subject.fy = d3.event.subject.y;
  // }

  function dragged() {
    // d3.event.subject.fx = d3.event.x;
    // d3.event.subject.fy = d3.event.y;
    d3.event.subject.x = transform.invertX(d3.event.x);
    d3.event.subject.y = transform.invertY(d3.event.y);
    redraw();
  }

  function clicked() {
    /* eslint max-len:0 */

    const x = d3.event.offsetX;
    const y = d3.event.offsetY;
    let r;
    for (let i = 0; i < conf.data.nodes.length; i += 1) {
      const thisNode = conf.data.nodes[i];
      const dist = Math.sqrt(((thisNode.x - x) * (thisNode.x - x)) + ((thisNode.y - y) * (thisNode.y - y)));
      // console.log(`${x},${y} vs ${thisNode.term}:${thisNode.x},${thisNode.y} (${thisNode.radius} vs ${dist}) -- ${transform.k}`);
      if (dist <= (thisNode.radius)) {
        thisNode.x = transform.invertX(d3.event.offsetX);
        thisNode.y = transform.invertY(d3.event.offsetY);
        programmaticClick(thisNode);
        // return;
        r = thisNode;
      }
    }
    return r;

    // conf.data.nodes.forEach((n) => {
    //   console.log(`${n.term} -- ${n.x},${n.y} vs ${x},${y}`);
    //   const dist = Math.sqrt(((n.x - x) * (n.x - x)) + ((n.y - y) * (n.y - y)));
    //   if (dist <= n.radius) {
    //     programmaticClick(n);
    //     return;
    //   }
    // });
    // const thisNode = force.find(x, y, conf.maxNodeSize);
    // console.log('clicked node...');
    // console.log(thisNode);

    // programmaticClick(thisNode);

    // if (subject.trullySelected === true) {
    //   unselectNode(subject);
    //   dispatch.call('unselected', this, subject);
    // }
    // else {
    //   selectNode(subject);
    //   // subject.trullySelected = true;
    //   dispatch.call('selected', this, subject);
    // }
  }

  // function dragended() {
  //   if (!d3.event.active) force.alphaTarget(0);
  //   d3.event.subject.fx = null;
  //   d3.event.subject.fy = null;
  // }

  // function unselectAll() {
  //   const nodes = data.nodes;
  //   nodes.forEach((d) => {
  //     delete d.selected;
  //     delete d.trullySelected;
  //   });
  // }


  function zoomed() {
    transform = d3.event.transform;
    redraw();
  }

  // function centerP (points) {
  //   let maxX = -Infinity;
  //   let maxY = -Infinity;
  //   let minX = Infinity;
  //   let minY = Infinity;
  //
  //   points.forEach((p) => {
  //     if (p.x > maxX) maxX = p.x;
  //     if (p.y > maxY) maxY = p.y;
  //     if (p.x < minX) minX = p.x;
  //     if (p.y < minY) minY = p.y;
  //   });
  //   const cx = minX + ~~((maxX - minX)/2);
  //   const cy = minY + ~~((maxY - minY)/2);
  //
  //   return {x: cx, y:cy};
  // }


  // function tick(e) {
  //     console.log(`alpha: ${force.alpha()}`);
  //
  //     link
  //         .attr("x1", (d) => d.source.x)
  //         .attr("y1", (d) => d.source.y)
  //         .attr("x2", (d) => d.target.x)
  //         .attr("y2", (d) => d.target.y);
  //
  //     node
  //         .attr("cx", (d) => d.x)
  //         .attr("cy", (d) => d.y);
  // }
  //
  //
  // link = svg.append("g")
  //     .attr("class", "links")
  //     .selectAll("line");
  // .selectAll("line");
  //     .data(data.links, (d) => `${d.source.id}-${d.target.id}`);
  // link.exit("remove");
  // link
  //     .enter().append("line")
  //     .attr("stroke-width", () => 1)
  //     .style({"stroke": "gray"});
  //
  //
  // node = svg.append("g")
  //     .attr("class", "nodes")
  //     .selectAll("circle");
  // .selectAll("circle");
  //     .data(data.nodes, (d) => d.id);
  // node.exit("remove");
  // node
  //     .enter().append("circle")
  //     .attr("cx", (d) => d.x)
  //     .attr("cy", (d) => d.y)
  //     .attr("r", config.nodeSize)
  //     .style("opacity", (d) => {
  //         if (d.visible) {
  //             return 1;
  //         }
  //         return 0.1;
  //     })
  //     .style("fill", (d) => {
  //         if (d.type === 'disease') return "yellow";
  //         if (d.type === 'omnipathdb') return "orange";
  //         if (d.type === 'terminal') return "lightgrey";
  //         return "green";
  //     })
  //     .style("stroke", (d, i) => "black")
  //     .call(force.drag)
  //     .on("mousedown", () => d3.event.stopPropagation())
  //     .on('click', (d) => console.log(d));
}
