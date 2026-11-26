import { fitWithin } from '@/engine';

describe('fitWithin', () => {
  it('shrinks a tall phone screenshot so its longest side is 1280', () => {
    expect(fitWithin(1206, 2622)).toEqual({ width: 589, height: 1280 });
  });

  it('shrinks a wide image the same way', () => {
    expect(fitWithin(4000, 2000)).toEqual({ width: 1280, height: 640 });
  });

  it('leaves a small image alone', () => {
    expect(fitWithin(800, 1280)).toEqual({ width: 800, height: 1280 });
    expect(fitWithin(300, 200)).toEqual({ width: 300, height: 200 });
  });

  it('never returns a zero side', () => {
    expect(fitWithin(10000, 3)).toEqual({ width: 1280, height: 1 });
  });
});
