  백엔드 (routine.py)                                                                                                   
  - SmartDefaultResponse: suggested_weight/reps/sets → suggested_sets_detail: list[SetDetail]                           
  - get_smart_default: user_routines에서 last_sets_detail 배열 그대로 반환, 폴백 시 workout_logs.sets 전체 세트 반환    
  - upsert_routine: query params → JSON body, last_weight/reps/sets → last_sets_detail                                  
                                                                                                                        
  백엔드 (demo.py)                                                                                                      
  - 선등록 upsert: last_weight/last_reps/last_sets → last_sets_detail 배열                                              
                                                                                                                        
  프론트엔드                                                                                                            
  - SmartDefaultData 타입: suggestedWeight/Reps/Sets → suggestedSetsDetail                                              
  - fetchSmartDefault: 응답 매핑 업데이트                                                                               
  - SmartDefault.tsx: 신규 기구면 기본값 1세트, 기존 기구면 suggestedSetsDetail 배열 그대로 세트 행으로 표시