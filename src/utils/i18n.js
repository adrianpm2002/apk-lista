let currentLocale = 'es';
export const setLocale = (loc) => { currentLocale = loc; };
export const getLocale = () => currentLocale;
const dictionaries = { es:{
	'common.lottery':'Lotería','common.playType':'Jugada','common.schedule':'Horario','common.note':'Nota','common.amount':'Monto','common.total':'Total','common.numbers':'Números','common.close':'Cerrar',
	'actions.clear':'Borrar','actions.insert':'Insertar','actions.verify':'Verificar',
	'placeholders.selectLotteries':'Seleccionar loterías','placeholders.selectPlayTypes':'Seleccionar jugadas','placeholders.selectSchedule':'Seleccionar horario','placeholders.noSchedules':'Sin horarios',
	'errors.selectLottery':'Selecciona una lotería','errors.selectAtLeastOnePlayType':'Selecciona al menos una jugada','errors.requiredOrFix':'Complete campos requeridos o corrija errores.','errors.singleInstructionEdit':'En edición solo se permite UNA instrucción/línea.','errors.parse':'Errores de parseo','errors.noValidInstructions':'Sin instrucciones válidas.','errors.editSingle':'En edición solo una instrucción.','errors.verify':'Error verificando.','errors.invalidLotterySchedule':'Lotería u horario inválido','errors.invalidLotterySchedule.detail':'Verifique lotería y horario.',
	'verify.summaryPrefix':'OK. Se insertarían','verify.limitViolations':'Violaciones de límite',
		'banner.inserted':'Insertadas','banner.fail':'Fallos','banner.duplicates':'Duplicados','banner.more':'Ver más','banner.less':'Ver menos',
	'limit.exceeded':'Número {n} ({j}) excedido por {x}',
	'edit.blocked':'Edición bloqueada por límites','edit.blocked.detail':'Ajusta montos o elimina números para no exceder capacidad.','edit.updated':'Jugada actualizada','edit.cancel':'Cancelar',
	'edit.modeHint':'Editando… Modifica la jugada y presiona Insertar para actualizar.','edit.modeHintError':'Editando: solo UNA instrucción permitida. Ajusta el texto.'
}, en:{
	'common.lottery':'Lottery','common.playType':'Play Type','common.schedule':'Schedule','common.note':'Note','common.amount':'Amount','common.total':'Total','common.numbers':'Numbers','common.close':'Close',
	'actions.clear':'Clear','actions.insert':'Insert','actions.verify':'Verify',
	'placeholders.selectLotteries':'Select lotteries','placeholders.selectPlayTypes':'Select play types','placeholders.selectSchedule':'Select schedule','placeholders.noSchedules':'No schedules',
	'errors.selectLottery':'Select a lottery','errors.selectAtLeastOnePlayType':'Select at least one play type','errors.requiredOrFix':'Fill required fields or fix errors.','errors.singleInstructionEdit':'In edit only ONE instruction/line is allowed.','errors.parse':'Parse errors','errors.noValidInstructions':'No valid instructions.','errors.editSingle':'In edit only one instruction.','errors.verify':'Error verifying.','errors.invalidLotterySchedule':'Invalid lottery or schedule','errors.invalidLotterySchedule.detail':'Check lottery and schedule.',
	'verify.summaryPrefix':'OK. Would insert','verify.limitViolations':'Limit violations',
		'banner.inserted':'Inserted','banner.fail':'Failed','banner.duplicates':'Duplicates','banner.more':'More','banner.less':'Less',
	'limit.exceeded':'Number {n} ({j}) exceeded by {x}',
	'edit.blocked':'Edit blocked by limits','edit.blocked.detail':'Adjust amounts or remove numbers to stay within capacity.','edit.updated':'Play updated','edit.cancel':'Cancel',
	'edit.modeHint':'Editing… Modify and press Insert to update.','edit.modeHintError':'Editing: only ONE instruction allowed. Adjust text.'
} };
export const t = (k,f)=>{ const d=dictionaries[currentLocale]||{}; return d[k]||f||k; };
export const translatePlayTypeLabel = (value)=>{ const map={ fijo:{es:'Fijo',en:'Fixed'}, corrido:{es:'Corrido',en:'Runner'}, posicion:{es:'Posición',en:'Position'}, parle:{es:'Parle',en:'Parlay'}, centena:{es:'Centena',en:'Hundred'}, tripleta:{es:'Tripleta',en:'Triplet'} }; return map[value]?.[currentLocale]||value; };
