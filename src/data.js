// import createNodes from './nodes.js';

import axios from 'axios';
import { schemePaired as topicColor } from 'd3-scale-chromatic';

// const topicCorr = {};

export function getQuery(query) {
  // const q = {
  //   query: {
  //     query_string: {
  //       query: query,
  //     },
  //   },
  //   controls: { use_significance: true, sample_size: 10000, timeout: 5000 },
  //   connections: { vertices: fields },
  //   vertices: fields,
  // };

  const url = `https://qkorhkwgf1.execute-api.eu-west-1.amazonaws.com/dev/search/topic?query=${query}`;

  return axios.get(url);

  // return axios.get('https://wt-emepyc-gmail-com-0.run.webtask.io/kibana-auth')
  //     .then (function (resp) {
  //         let token = resp.data;
  //         let ax = axios.create({
  //             timeout: 30000,
  //             headers: {
  //                 "Authorization": `Basic ${token}`
  //             }
  //         });
  //         const url = 'https://62d68b658f9e146c7b58491bd01ea91b.eu-west-1.aws.found.io:9243/!publication-data/_xpack/_graph/_explore';
  //         return ax.post(url, q);
  //     });
}

export function linksForNodes(vertices) {
  const links = [];
  vertices.forEach((d) => {
    d.interactors.forEach((c) => {
//      if (d.topic === c.topic) {
      links.push({
        source: d,
        target: c,
      });
//       }
    });
  });
  return links;
}

export function processLinks(vertices, links, topics) {
  // Get the topics correlation
  const topicsCorr = {};
  topics.forEach((t) => {
    topicsCorr[t.topic] = t.vertex;
  });

  // inLinks: links between nodes in a topic
  const inLinks = [];
  // outLinks: links between topic nodes
  const outLinks = [];
  const outLinksMap = {};

  links.forEach((v) => {
    const source = vertices[v.source];
    const target = vertices[v.target];

    // Same topic
    if (source.topic === target.topic) {
      inLinks.push({
        doc_count: v.doc_count,
        source,
        target,
        weight: v.weight,
        type: 'in',
      });
    }
    // Different topics
    else {
      // 1. Identify the topics involved
      const sourceTopicVertex = vertices[topicsCorr[source.topic]];
      const targetTopicVertex = vertices[topicsCorr[target.topic]];

      // 2. Set a link between them or just add to any existing link
      if (!outLinksMap[sourceTopicVertex.term]) {
        outLinksMap[sourceTopicVertex.term] = {};
      }
      if (!outLinksMap[sourceTopicVertex.term][targetTopicVertex.term]) {
        outLinksMap[sourceTopicVertex.term][targetTopicVertex.term] = {
          source: sourceTopicVertex,
          target: targetTopicVertex,
          n: 0,
        };
      }
      outLinksMap[sourceTopicVertex.term][targetTopicVertex.term].n += 1;
    }
  });

  // 3 get the outLinks based on the map
  Object.keys(outLinksMap).forEach((s) => {
    Object.keys(outLinksMap[s]).forEach((t) => {
      outLinks.push({
        doc_count: outLinksMap[s][t].n,
        source: outLinksMap[s][t].source,
        target: outLinksMap[s][t].target,
        weight: 0.01,
        type: 'out',
      });
    });
  });
  return {
    in: inLinks,
    out: outLinks,
  };
}

export function processTopics(vertices, topics) {
  /* eslint no-param-reassign: 0 */
  const newTopics = [];

  const verticesByTopics = {};
  vertices.forEach((v) => {
    if (verticesByTopics[v.topic] === undefined) {
      verticesByTopics[v.topic] = [];
    }
    verticesByTopics[v.topic].push(v);
  });

  const topicCorr = {};
  topics.forEach((t, i) => {
    const topicId = t.topic;
    topicCorr[topicId] = i;
    if (t.connected_topics.top.length) {
      newTopics.push({
        id: topicId,
        name: vertices[t.vertex].term,
        topVertices: t.connected_topics.top,
        vertices: verticesByTopics[topicId],
        color: topicColor[i] || '#dddddd',
        total: t.connected_topics.total + 1,
      });
    }
  });

  vertices.forEach((v) => {
    v.color = topicColor[topicCorr[v.topic]] || '#dddddd';
  });

  return newTopics;
}

export function setInteractors(nodes, links) {
  // nodes dict
  const nodesDict = {};
  nodes.forEach((d) => {
    const k = `${d.term}-${d.field}`;
    d.interactors = [];
    d.selected = 0;
    nodesDict[k] = d;
  });

  // First interactors for each node
  links.forEach((l) => {
    const source = nodes[l.source];
    const target = nodes[l.target];
    const kSource = `${source.term}-${source.field}`;
    const kTarget = `${target.term}-${target.field}`;
    nodesDict[kSource].interactors.push(target);
    nodesDict[kTarget].interactors.push(source);
  });
}

// export function toggleTerminals() {
//   config.terminals = !config.terminals;
//   console.log(`config.terminals is ${config.terminals}`);
//   let {nodes: allNodes, links: allLinks} = nodes.getAll({terminals: config.terminals});
//   return {
//     nodes: allNodes,
//     links: allLinks
//   };
// }

// export function highlightCluster(nodeId) {
//   let _allNodes = nodes.getNodes();
//
//   // If a node is not passed, highlight all
//   if (!nodeId) {
//     for (let node of _allNodes) {
//       node.visible = true;
//     }
//   } else {
//     // Remove highlighting from all the nodes
//     for (let node of _allNodes) {
//       node.visible = false;
//     }
//
//     // Test clustering...
//     let node = nodes.getNode(nodeId);
//     // It may be a clustered node, if so, take the first outLink...
//     if (!node) {
//       node = nodes.getNode(nodeId.split('-')[0]);
//     }
//
//     let disease1 = nodes.getNode(config.efo1);
//     let disease2 = nodes.getNode(config.efo2);
//     let cluster = nodes.getCluster(node, [disease1, disease2]);
//     for (let node of cluster) {
//       node.visible = true;
//     }
//   }
//
//   let {nodes: allNodes, links: allLinks} = nodes.getAll({terminals: config.terminals});
//   return {
//     nodes: allNodes,
//     links: allLinks
//   };
// }

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

// function getInteractors(uniprotId) {
//   const url = `http://www.omnipathdb.org/interactions/${uniprotId}?format=json&fields=sources`;
//   return axios.get(url)
//     .then(function (resp) {
//       // Here we are interested in proteins that interact with 2 targets (both associated with different diseases)
//       let data = resp.body;
//       let newLinks = new Map();
//       for (let link of data) {
//         let {source, target, sources} = link;
//
//         // Only take into account IntAct data
//         let hasIntact;
//         for (let i = 0; i < sources.length; i++) {
//           if (sources[i] === 'IntAct') {
//             // if (sources[i] === 'STRING') {
//             hasIntact = true;
//             break;
//           }
//         }
//         if (hasIntact) {
//           addNewLink(source, target, newLinks);
//           // addNewLink (target, source, newLinks);
//         }
//       }
//       return newLinks;
//     });
//
// }

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

// function addNewLink(key, newVal, links) {
//   if (!links.has(key)) {
//     links.set(key, new Set());
//   }
//   links.get(key).add(newVal);
// }

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
