/* global d3:true */

import apijs from 'tnt.api';
// import {getData, highlightCluster, toggleTerminals} from './data.js';
import { getQuery } from './data';

let force;
let link;
let node;
let context;
let transform = d3.zoomIdentity;
let linkWeightScale;
let nodeWeightScale;

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

const dispatch = d3.dispatch('click', 'dblclick', 'mouseover', 'mouseout', 'loaded', 'failed');

export default function () {

  const render = function (container) {

    getQuery(config.query, config.fields)
      .then((resp) => {
        console.log(resp);

        // If there is no graph, just fire the 'failed' event
        if (!resp.data.vertices.length || resp.status !== 200) {
          dispatch.call('failed');
          return;
        }

        config.data.nodes = resp.data.vertices;
        config.data.links = resp.data.connections;

        createForce(container, config);
        dispatch.call('loaded');
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

  render.update = update;
  render.highlightCluster = highlightCluster;

  // return d3.rebind(render, dispatch, "on");
  render.on = function () {
    /* eslint prefer-spread: 0 */
    /* eslint prefer-rest-params: 0 */
    const value = dispatch.on.apply(dispatch, arguments);
    return value === dispatch ? render : value;
  };

  return render;
}

function highlightCluster(n) {
  if (n) {
    config.data = highlightCluster(n.id);
  }
  else {
    config.data = highlightCluster();
  }
  return this;
}

function update() {
  // let data = config.data;
  // console.log(data);

  link = link
    .data(force.links(), (d) => `${d.source.id}-${d.target.id}`);
  link.exit()
    .remove();
  link
    .enter().append('line')
    .attr('stroke-width', () => 1)
    .style({ stroke: 'gray' });


  node = node
    .data(force.nodes(), (d) => d.id);

  node.exit()
    .remove();
  node
    .enter()
    .append('circle')
    .each(() => {
      console.log('new node created');
    })
    .attr('cx', (d) => d.x)
    .attr('cy', (d) => d.y)
    .attr('r', config.nodeSize)
    .style('stroke', 'black')
    .style('fill', (d) => {
      if (d.type === 'disease') return 'yellow';
      if (d.type === 'omnipathdb') return 'orange';
      if (d.type === 'terminal') return 'lightgrey';
      return 'green';
    })

    .call(force.drag)
    .on('mousedown', () => d3.event.stopPropagation())
    .on('click', function (d, i) {
      if (d3.event.defaultPrevented) {
        return;
      }
      dispatch.click.call(this, d, i);
    });

  node
    .style('opacity', (d) => {
      if (d.visible) {
        return 1;
      }
      return 0.1;
    });


  force.start();
}

function getLinkWeightExtent(conf) {
  const links = conf.data.links;
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

function createForce(container, conf) {
  const meter = d3.select(container)
    .append('div')
    .attr('class', 'interactions-network-progress')
    .node();

  linkWeightScale = getLinkWeightExtent(conf);
  nodeWeightScale = getNodeWeightExtent(conf);

  const canvas = d3.select(container)
    .append('canvas')
    .attr('width', conf.width)
    .attr('height', conf.height);
  // .call(d3.zoom().scaleExtent([0.5, 8]).on("zoom", zoom));

  context = canvas.node().getContext('2d');

  // let color = d3.scaleOrdinal(d3.schemeCategory20);
  // let color = "#aa5566";

  const data = conf.data;

  // Initialise the all the nodes in a sensible place
  data.nodes[0].x = ~~conf.width / 3;
  data.nodes[0].y = conf.height / 2;
  data.nodes[1].x = ~~(conf.width - (conf.width / 3));
  data.nodes[1].y = ~~conf.height / 2;
  for (let k = 2; k < data.nodes.length; k += 1) {
    data.nodes[k].x = ~~conf.width / 2;
    data.nodes[k].y = ~~conf.height / 2;
  }


  force = d3.forceSimulation(data.nodes)
    //.force('links', d3.forceLink(data.links).strength(1).distance(300).iterations(1))
    .force('charge', d3.forceManyBody().strength(-10))
    .force('center', d3.forceCenter().x(conf.width / 2).y(conf.height / 2))
    .force('collision', d3.forceCollide().radius(conf.nodeSize * 3))
    .force('links', d3.forceLink(data.links))
    .stop();

  // .on("tick", ticked)
  // .on("end", ended);

  canvas
    .call(d3.drag()
      .container(canvas.node())
      .subject(dragsubject)
      .on('start', clicked)
      .on('drag', dragged),
    )
    .call(d3.zoom()
      .scaleExtent([0.01, 5])
      .on('zoom', zoomed),
    );

  // Ticks
  const n = Math.ceil(Math.log(force.alphaMin()) / Math.log(1 - force.alphaDecay()));
  for (let i = 1; i <= n; i += 1) {
    force.tick();
  }

  // And clear the progressing bar
  ticked();
  ended();


  function ticked() {
    const progress = 1 - force.alpha();
    meter.style.width = `${100 * progress}%`;
    redraw();
  }

  function redraw() {
    context.clearRect(0, 0, conf.width, conf.height);
    context.save();

    context.translate(transform.x, transform.y);
    context.scale(transform.k, transform.k);

    // Draw links
    data.links.forEach(drawLink);

    // Draw nodes
    data.nodes.forEach(drawNode);

    context.restore();
  }

  function ended() {
    meter.style.display = 'none';
  }

  function dragsubject() {
    /* eslint consistent-return: 0 */
    const x = transform.invertX(d3.event.x);
    const y = transform.invertY(d3.event.y);
    const thisNode = force.find(x, y, conf.maxNodeSize);
    if (!thisNode) {
      unselectAll();
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
    const subject = d3.event.subject;
    d3.event.subject.x = transform.invertX(d3.event.x);
    d3.event.subject.y = transform.invertY(d3.event.y);
    if (subject.trullySelected === true) {
      unselectAll();
    }
    else {
      selectNode(subject);
      subject.trullySelected = true;
    }
    redraw();
  }

  // function dragended() {
  //   if (!d3.event.active) force.alphaTarget(0);
  //   d3.event.subject.fx = null;
  //   d3.event.subject.fy = null;
  // }

  function unselectAll() {
    const nodes = data.nodes;
    nodes.forEach((d) => {
      delete d.selected;
      delete d.trullySelected;
    });
  }

  function selectNode(n) {
    /* eslint no-param-reassign: 0 */
    unselectAll();

    const links = data.links;
    links.forEach((d) => {
      if ((d.source.index === n.index) || (d.target.index === n.index)) {
        d.source.selected = true;
        d.target.selected = true;
      }
      else {
        if (d.source.selected !== true) {
          d.source.selected = false;
        }
        if (d.target.selected !== true) {
          d.target.selected = false;
        }
      }
    });
  }

  function drawLink(d) {
    context.beginPath();
    context.strokeStyle = '#8da0cb';
    if ((d.source.selected === true) && (d.target.selected === true)) {
      context.globalAlpha = 0.5;
    }
    else if ((d.source.selected === false) || (d.target.selected === false)) {
      context.globalAlpha = 0.05;
    }
    else {
      context.globalAlpha = 0.5;
    }
    context.moveTo(d.source.x, d.source.y);
    context.lineWidth = linkWeightScale(d.weight);
    context.lineTo(d.target.x, d.target.y);
    context.stroke();
    context.globalAlpha = 1;
  }

  function drawNode(d) {
    const nodeSize = nodeWeightScale(d.weight);

    // Node
    context.beginPath();
    context.moveTo(d.x, d.y);
    context.fillStyle = conf.colors[d.field];
    if (d.selected === true) {
      context.globalAlpha = 0.8;
    }
    else if (d.selected === false) {
      context.globalAlpha = 0.05;
    }
    else {
      context.globalAlpha = 0.5;
    }
    context.arc(d.x, d.y, nodeSize, 0, 2 * Math.PI);
    context.fill();

    // circle
    if (d.selected === true) {
      context.beginPath();
      context.globalAlpha = 1;
      context.arc(d.x, d.y, nodeSize + 5, 0, 2 * Math.PI);
      context.strokeStyle = conf.colors[d.field];
      context.stroke();
    }
    else if (d.selected !== false) {
      context.beginPath();
      context.globalAlpha = 0.5;
      context.arc(d.x, d.y, nodeSize + 1, 0, 2 * Math.PI);
      context.strokeStyle = conf.colors[d.field];
      context.stroke();
    }

    // label
    if (d.selected !== false) {
      context.globalAlpha = 1;
    }
    else {
      context.globalAlpha = 0;
    }
    context.textAlign = 'center';
    context.fillStyle = 'black';
    context.fillText(d.term, d.x, d.y + (nodeSize + 15));
  }

  function zoomed() {
    transform = d3.event.transform;
    redraw();
  }

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
