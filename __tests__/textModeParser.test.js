import { parseTextMode } from '../src/utils/textModeParser';

describe('parseTextMode', () => {
  test('devuelve vacío para texto vacío', () => {
    const r = parseTextMode('', { isLocked:false });
    expect(r.instructions).toHaveLength(0);
    expect(r.errors).toHaveLength(0);
  });

  test('parsea fijo/corrido', () => {
    const r = parseTextMode('12 25 -5-3', { isLocked:false });
    const fijo = r.instructions.find(i=> i.playType==='fijo');
    const corrido = r.instructions.find(i=> i.playType==='corrido');
    expect(fijo).toBeTruthy();
    expect(corrido).toBeTruthy();
    expect(fijo.amountEach).toBe(5);
    expect(corrido.amountEach).toBe(3);
  });

  test('candado reparte parle combinatorio', () => {
    const r = parseTextMode('12*25*30 -90', { isLocked:true });
    const parle = r.instructions[0];
    expect(parle.playType).toBe('parle');
    // 3 números => 3 combinaciones => 90/3 = 30
    expect(parle.amountEach).toBe(30);
    expect(parle.totalPerLottery).toBe(90);
  });

  test('candado abierto multiplica parle combinatorio', () => {
    const r = parseTextMode('12*25*30 -90', { isLocked:false });
    const parle = r.instructions[0];
    // 3 combinaciones * 90 cada una
    expect(parle.totalPerLottery).toBe(270);
  });

  test('error montos cero fijo/corrido', () => {
    const r = parseTextMode('12 25 -0-0', { isLocked:false });
    expect(r.errors.some(e=> e.message.includes('Ambos montos 0'))).toBe(true);
  });

  test('centena valida', () => {
    const r = parseTextMode('123 555 -20', { isLocked:false });
    const c = r.instructions.find(i=> i.playType==='centena');
    expect(c).toBeTruthy();
    expect(c.numbers).toEqual(['123','555']);
    expect(c.amountEach).toBe(20);
  });

  test('tripleta valida', () => {
    const r = parseTextMode('123456 654321 -50', { isLocked:false });
    const t = r.instructions.find(i=> i.playType==='tripleta');
    expect(t).toBeTruthy();
    expect(t.numbers.length).toBe(2);
    expect(t.amountEach).toBe(50);
  });

  test('parles directos', () => {
    const r = parseTextMode('1225 3099 -15', { isLocked:false });
    const p = r.instructions.find(i=> i.playType==='parle' && i.meta?.mode==='direct');
    expect(p).toBeTruthy();
    expect(p.numbers).toEqual(['1225','3099']);
  });

  test('error longitudes mezcladas', () => {
    const r = parseTextMode('12 123 -5', { isLocked:false });
    expect(r.errors.some(e=> e.message.includes('Longitudes mezcladas'))).toBe(true);
  });
});
