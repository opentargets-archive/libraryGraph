let nodesMap = {
    nodes: new Map()
};
export default function createNodes() {
    return nodesMap;
};

// Setters
nodesMap.addNode = function ({id, label, fixed = false, type = "target"}) {
    // A new node is only added if it doesn't exist already
    if (!nodesMap.getNode(id)) {
        nodesMap.nodes.set(id, {
            id: id,
            label: label,
            fixed: fixed,
            visible: true,
            type: type,
            outLinks: new Set(),
            inLinks: new Set(),
            terminals: new Set()
        });
    }
    return this;
};

nodesMap.addLink = function (source, target) { // source and targets are ids
    // Get the source
    let n1 = nodesMap.nodes.get(source);
    let n2 = nodesMap.nodes.get(target);

    if (!n1 || !n2) {
        throw('Unable to create a link: either the source or the target does not exist');
    }

    // We only add the link from the source to the target
    // TODO: Should we do the link from the target to the source as well?
    // Outlinks
    n1.outLinks.add(n2);

    // Inlinks
    n2.inLinks.add(n1);

    return this;
};

// Actions / filtering

nodesMap.getCluster = function (source, dest) {
    let visited = new Set();
    let toVisit = [source];

    let cluster = [];

    visitCluster(cluster, visited, toVisit, dest);
    return cluster
};

function visitCluster(cluster, visited, toVisit, dest) { // dest is an array of destination nodes
    // take the next node to visit:
    let node;
    while (!node && toVisit.length) {
        let k = toVisit.shift();
        if (!visited.has(k.id)) {
            node = k;
            visited.add(node.id);
        }
    }
    // If there is no node, we are done
    if (!node) {
        return;
    }

    // If we have a node to visit, visit and go the the next nodes
    // node.visible = true;
    cluster.push(node);

    // If the node is the destination file, don't follow
    for (let d of dest) {
        if (node.id === d.id) {
            visitCluster(cluster, visited, toVisit, dest);
            return;
        }
    }

    // Otherwise, continue visiting the outLinks and inLinks
    for (let nextNode of node.outLinks) {
        toVisit.push(nextNode);
    }
    for (let nextNode of node.inLinks) {
        toVisit.push(nextNode);
    }
    visitCluster(cluster, visited, toVisit, dest);
}

// Cluster terminal nodes
nodesMap.joinTerminals = function () {
    for (let [nodeName, node] of nodesMap.nodes) {
        if ((node.outLinks.size === 1) && (node.inLinks.size === 0)) {
            node.isSingleton = true;
            let target = Array.from(node.outLinks.values())[0];
            target.terminals.add(nodeName);
        }
    }
};

// Getters
nodesMap.getNode = function (who) {
    return nodesMap.nodes.get(who);
};

nodesMap.getNodes = function () {
    return Array.from(nodesMap.nodes.values());
};

nodesMap.getAll = function ({terminals = false}) {
    if (!terminals) {
        console.log('joining terminals...');
        nodesMap.joinTerminals();
    }
    let all = {
        nodes: [],
        links: []
    };
    let indexes = new Map();
    for (let [name, node] of nodesMap.nodes) {
        // Check if we include singles (terminals) or not
        if (terminals) {
            // node.index = index;
            all.nodes.push(node);
            // indexes.set(name, index++);
            indexes.set(name, node);
        } else {
            if (!node.isSingleton) {
                // node.index = index;
                all.nodes.push(node);
                // indexes.set(name, index++);
                indexes.set(name, node);
            } else { // We have a singleton -- create a terminals node
                // If the terminals node is not there, create it
                // Create a node for a cluster of terminals
                let target = Array.from(node.outLinks.values())[0];
                let terminalsId = `${target.id}-terminals`;

                if (!indexes.has(terminalsId)) {
                    let terminalsNode = {
                        id: terminalsId,
                        label: `${target.terminals.size} nodes`,
                        fixed: false,
                        type: "terminal",
                        outLinks: new Set([target]),
                        inLinks: new Set(),
                        visible: true
                        // index: index
                    };
                    all.nodes.push(terminalsNode);
                    // indexes.set(terminalsId, index++);
                    indexes.set(terminalsId, terminalsNode);
                }
            }
        }
    }

    // Compute the links
    // TODO: This is looping again the same structure. There is room for improvement here
    for (let sourceNode of all.nodes) {
        let source = sourceNode;
        for (let target of sourceNode.outLinks) {
            all.links.push({
                source: source,
                target: indexes.get(target.id)
            });
        }
    }
    return all;
};