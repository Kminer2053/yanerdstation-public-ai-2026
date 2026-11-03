import {mapFeature} from './point-review-core.js';

export function isEntryTarget(point){
  return ['entry_candidate','walk_point'].includes(point?.record_kind)&&Boolean(mapFeature(point));
}

// These are reviewed location drafts, not an OD matrix or approved routing edges.
export function validateOriginAssignments(value,{origins,points,sourceRevision}){
  if(value==null)return null; // Older exports must not erase current assignments.
  if(value.schema_version!==1||!Array.isArray(value.assignments)||value.assignments.length>origins.length)
    throw Error('원점별 진입점 지정 형식이 올바르지 않습니다.');
  const originIds=new Set(origins.map(o=>o.id)),pointMap=new Map(points.map(p=>[p.review_id,p])),seen=new Set();
  const assignments=value.assignments.map(record=>{
    if(!originIds.has(record.origin_id)||seen.has(record.origin_id))throw Error('알 수 없거나 중복된 원점입니다.');
    seen.add(record.origin_id);
    if(!Array.isArray(record.point_ids)||!record.point_ids.length||record.point_ids.length>100||new Set(record.point_ids).size!==record.point_ids.length)
      throw Error('진입점 목록이 비어 있거나 중복되어 있습니다.');
    for(const id of record.point_ids){
      const point=pointMap.get(id);
      if(!isEntryTarget(point))throw Error('지도에서 확인 가능한 진입 후보 또는 이동점만 지정할 수 있습니다.');
    }
    return {origin_id:record.origin_id,point_ids:[...record.point_ids],user_approved:false,routing_enabled:false};
  });
  if(assignments.length&&value.source_revision!==sourceRevision)throw Error('진입점 자료 버전이 다릅니다. 위치를 다시 검토하세요.');
  return {schema_version:1,source_revision:sourceRevision,assignments,routing_enabled:false};
}

export function assignOriginPoint(assignments,originId,pointId,context){
  const records=assignments.map(r=>({...r,point_ids:[...r.point_ids]}));
  const record=records.find(r=>r.origin_id===originId);
  if(record){if(!record.point_ids.includes(pointId))record.point_ids.push(pointId);}
  else records.push({origin_id:originId,point_ids:[pointId]});
  return validateOriginAssignments({schema_version:1,source_revision:context.sourceRevision,assignments:records},context).assignments;
}
