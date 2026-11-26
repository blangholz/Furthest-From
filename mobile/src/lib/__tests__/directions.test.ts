import { mapsApps } from '../directions';

describe('mapsApps', () => {
  const apps = mapsApps({ lat: 42.1, lon: -110.5 });
  it('always lists Apple Maps first with no probe', () => {
    expect(apps[0].name).toBe('Apple Maps');
    expect(apps[0].probe).toBeUndefined();
  });
  it('puts the destination in every URL', () => apps.forEach((a) => expect(a.url).toContain('42.1,-110.5')));
});
