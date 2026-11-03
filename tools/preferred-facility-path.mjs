import {shortestFrom, shortestPath} from './shortest-workbench-routes.mjs';

// Reviewed visitor itinerary, not a change to OD allocation or wheelchair routing.
// Constrain only this journey to the specified upward escalator; each approach
// remains the shortest mesh-verified path on its own floor.
export function preferredFacilityPath(graph, endpoint, facility, fallback) {
  if(endpoint.id!=='OD-be79931e-9d7f-4aec-8d0c-19f76da23762' || facility.id!=='DEST-F03WL006-S01') return fallback;
  const connectionId='AUTO-F02MV007-4-1';
  const rides=[];
  graph.adj.forEach((row,from)=>row.forEach(e=>{if(e.connection_id===connectionId) rides.push({from,edge:e});}));
  if(rides.length!==1) throw new Error('Reviewed upward escalator must have exactly one directed edge');
  const {from,edge}=rides[0], a=graph.points[from], b=graph.points[edge.to];
  const walking={...graph,adj:graph.adj.map((row,i)=>row.filter(e=>!e.connection_id && graph.points[i].floor===graph.points[e.to].floor))};
  const before=shortestPath(walking,shortestFrom(walking,endpoint.access_id),a.review_id);
  const after=shortestPath(walking,shortestFrom(walking,b.review_id),facility.access_id);
  if(!before || !after) throw new Error('Reviewed escalator approach is disconnected');
  return {distance_m:before.distance_m+edge.cost+after.distance_m,
    edges:[...before.edges,{from:a.review_id,to:b.review_id,cost:edge.cost,connection_id:connectionId},...after.edges],
    routing_policy:'reviewed_escalator_F02MV007-4'};
}
