import apijs from 'tnt.api';
// import {getData, highlightCluster, toggleTerminals} from './data.js';
import {getQuery} from './data.js';

let force;
let link;
let node;
let context;
let transform = d3.zoomIdentity;
let weightScale;

let config = {
    colors: {}, // expect
    radius: 10,
    fields: {},
    collapseSingletons: true,
    query: "IL33 AND asthma",
    data: {},
    width: 800,
    height: 800,
    nodeSize: 5,
    colorScale: d3.scaleLinear()
        .range([d3.rgb("#007AFF"), d3.rgb('#FFF500')]) // The domain is set dynamically
};

let dispatch = d3.dispatch("click", "dblclick", "mouseover", "mouseout", "select", "unselect", "interaction");

export default function () {

    let render = function (container) {
        getQuery(config.query, config.fields)
            .then (function (resp) {
                console.log(resp);
                config.data.nodes = resp.data.vertices;
                config.data.links = resp.data.connections;

                createForce(container, config);
            })
            .catch(function (err) {
                console.trace(err.message);
            });
    };

    let api = apijs(render).getset(config);

    function _toggleTerminals () {
        config.data = toggleTerminals();
        return this;
    }

    api.method('toggleTerminals', _toggleTerminals);

    render.update = update;
    render.highlightCluster = _highlightCluster;

    // return d3.rebind(render, dispatch, "on");
    render.on = function () {
        let value = dispatch.on.apply(dispatch, arguments);
        return value === dispatch ? render : value;
    };

    return render;
};

function _highlightCluster(node) {
    if (node) {
        config.data = highlightCluster(node.id);
    } else {
        config.data = highlightCluster();
    }
    return this;
}

function update () {
    // let data = config.data;
    // console.log(data);

    link = link
        .data(force.links(), (d) => `${d.source.id}-${d.target.id}`);
    link.exit()
        .remove();
    link
        .enter().append("line")
        .attr("stroke-width", () => 1)
        .style({"stroke": "gray"});


    node = node
        .data(force.nodes(), (d) => d.id);

    node.exit()
        .remove();
    node
        .enter()
        .append("circle")
        .each((d) => {
            console.log(`new node created`);
        })
        .attr("cx", (d) => d.x)
        .attr("cy", (d) => d.y)
        .attr("r", config.nodeSize)
        .style("stroke", (d, i) => "black")
        .style("fill", (d) => {
            if (d.type === 'disease') return "yellow";
            if (d.type === 'omnipathdb') return "orange";
            if (d.type === 'terminal') return "lightgrey";
            return "green";
        })

        .call(force.drag)
        .on("mousedown", () => d3.event.stopPropagation())
        .on('click', function (d, i) {
            if (d3.event.defaultPrevented) {
                return;
            }
            dispatch.click.call(this, d, i);
        });

    node
        .style("opacity", (d) => {
            if (d.visible) {
                return 1;
            }
            return 0.1;
        });


    force.start();
}

function getWeightExtent(config) {
    let links = config.data.links;
    let extent = d3.extent(links, function (d) {
        return d.weight;
    });
    return  d3.scaleLinear()
        .domain(extent)
        .range([1, config.radius*0.7])
}

function createForce(container, config) {

    let meter = d3.select(container)
        .append("div")
        .attr("class", "interactions-network-progress")
        .node();

    weightScale = getWeightExtent(config);

    let canvas = d3.select(container)
        .append("canvas")
        .attr("width", config.width)
        .attr("height", config.height);
        // .call(d3.zoom().scaleExtent([0.5, 8]).on("zoom", zoom));

    context = canvas.node().getContext("2d");

    // let color = d3.scaleOrdinal(d3.schemeCategory20);
    // let color = "#aa5566";

    let data = config.data;

    // Initialise the all the nodes in a sensible place
    data.nodes[0].x = ~~config.width / 3;
    data.nodes[0].y = config.height / 2;
    data.nodes[1].x = ~~(config.width - config.width / 3);
    data.nodes[1].y = ~~config.height / 2;
    for (let k = 2; k < data.nodes.length; k++) {
        data.nodes[k].x = ~~config.width / 2;
        data.nodes[k].y = ~~config.height / 2;
    }


    force = d3.forceSimulation(data.nodes)
        // .force("charge", d3.forceManyBody().strength(-30))
        .force("center", d3.forceCenter().x(config.width/2).y(config.height/2))
        // .force("links", d3.forceLink(data.links).strength(1).distance(150).iterations(10))
        .force("collision", d3.forceCollide().radius(30))
        .force("links", d3.forceLink(data.links))
        .stop();

        // .on("tick", ticked)
        // .on("end", ended);

    canvas
        .call(d3.drag()
            .container(canvas.node())
            .subject(dragsubject)
            .on("drag", dragged)
        )
        .call(d3.zoom()
            .scaleExtent([0.5, 5])
            .on("zoom", zoomed));


    // Ticks
    let n = Math.ceil(Math.log(force.alphaMin()) / Math.log(1 - force.alphaDecay()));
    for (let i=0; i<n; ++i) {
        force.tick();
    }

    // And clear the progressing bar
    ticked();
    ended();


    function ticked() {
        let progress = 1-force.alpha();
        meter.style.width = 100 * progress + "%";
        redraw();
    }

    function redraw() {
        context.clearRect(0, 0, config.width, config.height);
        context.save();

        context.translate(transform.x, transform.y);
        context.scale(transform.k, transform.k);

        // Draw links
        context.strokeStyle = "#aaa";
        data.links.forEach(drawLink);

        // Draw nodes
        data.nodes.forEach(drawNode);

        context.restore();
    }

    function ended() {
        meter.style.display = "none";
    }

    function dragsubject() {
        let x = transform.invertX(d3.event.x);
        let y = transform.invertY(d3.event.y);

        let thisNode = force.find(x, y, config.radius);
        if (!thisNode) return;
        thisNode.x = transform.applyX(thisNode.x);
        thisNode.y = transform.applyY(thisNode.y);
        return thisNode;
    }


    function dragstarted() {
        // if (!d3.event.active) force.alphaTarget(0.3).restart();
        d3.event.subject.fx = d3.event.subject.x;
        d3.event.subject.fy = d3.event.subject.y;
    }

    function dragged() {
        // d3.event.subject.fx = d3.event.x;
        // d3.event.subject.fy = d3.event.y;
        d3.event.subject.x = transform.invertX(d3.event.x);
        d3.event.subject.y = transform.invertY(d3.event.y);
        redraw();
    }

    function dragended() {
        if (!d3.event.active) force.alphaTarget(0);
        d3.event.subject.fx = null;
        d3.event.subject.fy = null;
    }

    function drawLink(d) {
        context.beginPath();
        context.moveTo(d.source.x, d.source.y);
        context.lineWidth=weightScale(d.weight);
        context.lineTo(d.target.x, d.target.y);
        context.stroke();

    }

    function drawNode(d) {
        context.beginPath();
        context.moveTo(d.x, d.y);
        context.fillStyle = config.colors[d.field];
        context.arc(d.x, d.y, config.radius, 0, 2 * Math.PI);
        context.fill();
        context.textAlign="center";
        context.fillText(d.term, d.x, d.y+20);
        context.strokeStyle = "#aaa";
        context.stroke();

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