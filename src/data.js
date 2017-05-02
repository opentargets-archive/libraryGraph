
import createNodes from './nodes.js';

import axios from 'axios';

export function getQuery(query, fields) {
    let q = {
        "query": {
            "query_string": {
                "query": query
            }
        }
        ,
        "controls": {"use_significance": true, "sample_size": 2000, "timeout": 5000},
        "connections": {"vertices": fields},
        "vertices": fields,
    };

    return axios.get('https://wt-emepyc-gmail-com-0.run.webtask.io/kibana-auth')
        .then (function (resp) {
            let token = resp.data;
            let ax = axios.create({
                timeout: 30000,
                headers: {
                    "Authorization": `Basic ${token}`
                }
            });
            const url = 'https://62d68b658f9e146c7b58491bd01ea91b.eu-west-1.aws.found.io:9243/!publication-data/_xpack/_graph/_explore';
            return ax.post(url, q);
        });
}


export function toggleTerminals() {
    config.terminals = !config.terminals;
    console.log(`config.terminals is ${config.terminals}`);
    let {nodes: allNodes, links: allLinks} = nodes.getAll({terminals: config.terminals});
    return {
        nodes: allNodes,
        links: allLinks
    };
}

export function highlightCluster(nodeId) {
    let _allNodes = nodes.getNodes();

    // If a node is not passed, highlight all
    if (!nodeId) {
        for (let node of _allNodes) {
            node.visible = true;
        }
    } else {
        // Remove highlighting from all the nodes
        for (let node of _allNodes) {
            node.visible = false;
        }

        // Test clustering...
        let node = nodes.getNode(nodeId);
        // It may be a clustered node, if so, take the first outLink...
        if (!node) {
            node = nodes.getNode(nodeId.split('-')[0]);
        }

        let disease1 = nodes.getNode(config.efo1);
        let disease2 = nodes.getNode(config.efo2);
        let cluster = nodes.getCluster(node, [disease1, disease2]);
        for (let node of cluster) {
            node.visible = true;
        }
    }

    let {nodes: allNodes, links: allLinks} = nodes.getAll({terminals: config.terminals});
    return {
        nodes: allNodes,
        links: allLinks
    };
}

// function extractTargets(d1, d2) {
//     let targets = new Set();
//     for (let d of d1) {
//         targets.add(d.target.id);
//     }
//     for (let d of d2) {
//         targets.add(d.target.id);
//     }
//     return targets;
// }

// function getNodesAndLinks (nodes, ...data) {
//     for (let i=0; i<data.length; i++) {
//         let thisData = data[i];
//         for (let j=0; j<thisData.length; j++) {
//             let t = thisData[j];
//             let id = t.target.gene_info.symbol;
//             let disease = t.disease.id;
//             nodes.addNode({
//                 id: id,
//                 label: id
//             });
//             nodes.addLink(id, disease);
//         }
//     }
// }

function getInteractors(uniprotId) {
    const url = `http://www.omnipathdb.org/interactions/${uniprotId}?format=json&fields=sources`;
    return axios.get(url)
        .then(function (resp) {
            // Here we are interested in proteins that interact with 2 targets (both associated with different diseases)
            let data = resp.body;
            let newLinks = new Map();
            for (let link of data) {
                let {source, target, sources} = link;

                // Only take into account IntAct data
                let hasIntact;
                for (let i = 0; i < sources.length; i++) {
                    if (sources[i] === 'IntAct') {
                        // if (sources[i] === 'STRING') {
                        hasIntact = true;
                        break;
                    }
                }
                if (hasIntact) {
                    addNewLink(source, target, newLinks);
                    // addNewLink (target, source, newLinks);
                }
            }
            return newLinks;
        });

}

// function getTargets(efo, size, minScore) {
//     const url = api.url.associations({
//         disease: efo,
//         facets: false,
//         size: size,
//         direct: true,
//         min_score: minScore,
//         fields: ['association_score.overall', 'target.id', 'target.gene_info.symbol', 'disease.efo_info.label', 'disease.id']
//     });
//
//     return api.call(url)
//         .then(function (resp) {
//             return resp.body.data;
//         });
// }

function addNewLink(key, newVal, links) {
    if (!links.has(key)) {
        links.set(key, new Set());
    }
    links.get(key).add(newVal);
}

// Uniprot to symbols mapping
// let u2s = new Map();
// function getOmnipathData(targets) {
//     // First we need the uniprot ids for the target:
//     let urlR1 = api.url.target();
//
//     urlR1 = urlR1.substring(0, urlR1.length - 1);
//     let params = {
//         id: Array.from(targets),
//         fields: ['approved_symbol', 'uniprot_id']
//     };
//     return api.call(urlR1, params)
//         .then(function (resp) {
//             // create a map to convert uniprot ids to symbols
//             return resp.body.data.map((d) => {
//                 u2s.set(d.uniprot_id, d.approved_symbol);
//                 return d.uniprot_id;
//             });
//         })
//         .then(function (ids) {
//             const urlR2 = `http://www.omnipathdb.org/interactions/${ids.join(",")}?format=json&fields=sources`;
//             // return d3.json(urlR2, function (err, data) {
//             return http.get(urlR2)
//                 .then(function (resp) {
//                     // Here we are interested in proteins that interact with 2 targets (both associated with different diseases)
//                     let data = resp.body;
//                     let newLinks = new Map();
//                     for (let link of data) {
//                         let {source, target, sources} = link;
//
//                         // Only take into account IntAct data
//                         let hasIntact;
//                         for (let i = 0; i < sources.length; i++) {
//                             if (sources[i] === 'IntAct') {
//                                 // if (sources[i] === 'STRING') {
//                                 hasIntact = true;
//                                 break;
//                             }
//                         }
//                         if (hasIntact) {
//                             let sSymbol = u2s.get(source);
//                             let tSymbol = u2s.get(target);
//                             // Source and target has to be in the map and they should be associated to different nodes
//                             if (!sSymbol) {
//                                 addNewLink(source, tSymbol, newLinks);
//                             }
//                             if (!tSymbol) {
//                                 addNewLink(target, sSymbol, newLinks);
//                             }
//
//                             // Direct links between targets
//                             if (sSymbol && tSymbol) {
//                                 addNewLink(sSymbol, tSymbol, newLinks);
//                             }
//                         }
//                     }
//                     return newLinks;
//                 });
//         });
// }
