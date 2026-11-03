const FLOORS=new Set(['B7','B6','B3','B2','B1','1F','2F','3F']);
const VIEWS=new Set(['bird','first','third']);
// GRID-2F--2-30: connected open-grid point inside the registered hall-center zone.
export const CENTRAL_HALL_POINT=Object.freeze([126.97077473168527,37.554170595644045,36.189566847868264]);

// An explicit visitor link only. Never infer a navigation command from arbitrary URL values.
export function explorationEntry(params){
  if(params.get('mode')!=='explore'||['business','manager'].includes(params.get('role')))return null;
  const floor=FLOORS.has(params.get('floor'))?params.get('floor'):'2F';
  const view=VIEWS.has(params.get('view'))?params.get('view'):'third';
  return {place:floor==='2F'?'hall-center':'floor:'+floor,view};
}

// Catalogue and iframe may finish in either order; repeated readiness events must not teleport again.
export function createExplorationEntry(params){
  const entry=explorationEntry(params);let pending=Boolean(entry);
  return {
    get pending(){return pending;},
    cancel(){pending=false;},
    apply({ready,role,start}){
      if(!pending||!ready||role!=='visitor')return false;
      pending=false;start(entry);return true;
    },
  };
}
