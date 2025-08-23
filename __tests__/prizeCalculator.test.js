import { parseResultado, winnersByType, evaluatePlay, canonicalParle, DEFAULT_PRICES, formatMoney } from '../src/utils/prizeCalculator';

describe('prizeCalculator', () => {
  const numeros = '234 5984';
  const parsed = parseResultado(numeros);
  const prices = {
    fijo: { limited: 50, regular: 80 },
    corrido: { limited: 50, regular: 80 },
    centena: { limited: 500, regular: 800 },
    parle: { limited: 900, regular: 1200 },
    tripleta: { limited: 10000, regular: 15000 },
  };

  test('parseResultado y winners básicos', () => {
    expect(parsed.fijo).toBe('34');
    expect(parsed.corridos).toEqual(['59','84']);
    expect(parsed.centena).toBe('234');
    const parleWins = Array.from(parsed.parleWinners);
    // Debe incluir 3459, 3484 y 5984 (canónicos para parle)
    expect(parleWins).toEqual(expect.arrayContaining([canonicalParle('3459'), canonicalParle('3484'), canonicalParle('5984')]));
    // Tripleta: 6 permutaciones
    expect(parsed.tripletaWinners.size).toBe(6);
  });

  test('evaluate fijo ganador y limitado', () => {
    const play = { playType:'fijo', numbers:'34', amount:2 };
    const limitedSet = new Set(['34']);
    const r = evaluatePlay(play, parsed, limitedSet, prices);
    expect(r.hasPrize).toBe(true);
    expect(r.pay).toBe(2 * prices.fijo.limited);
  });

  test('evaluate corrido ganador regular', () => {
    const play = { playType:'corrido', numbers:'59,84,00', amount:1 };
    const limitedSet = new Set();
    const r = evaluatePlay(play, parsed, limitedSet, prices);
    // 59 y 84 ganan
    expect(r.hasPrize).toBe(true);
    expect(r.pay).toBe(2 * prices.corrido.regular);
  });

  test('evaluate centena pierde', () => {
    const play = { playType:'centena', numbers:'999', amount:5 };
    const r = evaluatePlay(play, parsed, new Set(), prices);
    expect(r.hasPrize).toBe(false);
    expect(r.pay).toBe(0);
  });

  test('evaluate parle canónico mixto', () => {
    const play = { playType:'parle', numbers:'3459,5934,1234', amount:1 };
    const r = evaluatePlay(play, parsed, new Set(['5934']), prices);
    // 3459 y 5934 son equivalentes, ambos ganan y uno limitado
    const expected = prices.parle.regular + prices.parle.limited;
    expect(r.hasPrize).toBe(true);
    expect(r.pay).toBe(expected);
  });

  test('evaluate tripleta alguno gana', () => {
    // Una de las 6 permutaciones válidas
    const play = { playType:'tripleta', numbers:'345984,000000', amount:1 };
    const r = evaluatePlay(play, parsed, new Set(), prices);
    expect(r.hasPrize).toBe(true);
    expect(r.pay).toBe(prices.tripleta.regular);
  });
});
