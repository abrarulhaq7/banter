import { fieldsFromProfile, patchFromFields, validateProfile, type ProfileFields } from '@/data';
import { makeProfile } from '@/test-utils';

const fields = (overrides: Partial<ProfileFields> = {}): ProfileFields => ({
  name: 'Sam',
  age: '',
  city: '',
  work: '',
  interests: '',
  textingStyle: '',
  ...overrides,
});

describe('validateProfile', () => {
  it('needs only a name', () => {
    expect(validateProfile(fields())).toEqual({});
    expect(validateProfile(fields({ name: '   ' }))).toEqual({ name: 'Enter your name.' });
  });

  it('accepts ages from 18', () => {
    expect(validateProfile(fields({ age: '18' }))).toEqual({});
    expect(validateProfile(fields({ age: ' 34 ' }))).toEqual({});
  });

  it('refuses anyone under 18', () => {
    expect(validateProfile(fields({ age: '17' })).age).toBe(
      'Banter is for adults. You must be 18 or older.',
    );
  });

  it.each(['abc', '2x', '-5', '1.5'])('refuses %p as an age', (age) => {
    expect(validateProfile(fields({ age })).age).toBe('Enter your age as a number.');
  });

  it('refuses an impossible age', () => {
    expect(validateProfile(fields({ age: '150' })).age).toBe('Check your age.');
  });

  it('keeps text within the limits the database enforces', () => {
    expect(validateProfile(fields({ name: 'x'.repeat(81) })).name).toBe('Keep this under 80 characters.');
    expect(validateProfile(fields({ textingStyle: 'x'.repeat(2001) })).textingStyle).toBe(
      'Keep this under 2000 characters.',
    );
    expect(validateProfile(fields({ textingStyle: 'x'.repeat(2000) }))).toEqual({});
  });
});

describe('patchFromFields', () => {
  it('trims text, turns the age into a number and stores blanks as "not given"', () => {
    expect(
      patchFromFields(fields({ name: ' Sam ', age: '27', city: ' Lahore ', interests: '   ' })),
    ).toEqual({
      display_name: 'Sam',
      age: 27,
      city: 'Lahore',
      work: null,
      interests: null,
      texting_style: null,
    });
  });
});

describe('fieldsFromProfile', () => {
  it('fills the form from a saved profile', () => {
    expect(fieldsFromProfile(makeProfile({ display_name: 'Sam', age: 27, texting_style: 'dry' }))).toEqual(
      fields({ age: '27', textingStyle: 'dry' }),
    );
  });

  it('gives an empty form when there is no profile yet', () => {
    expect(fieldsFromProfile(null)).toEqual(fields({ name: '' }));
  });
});
