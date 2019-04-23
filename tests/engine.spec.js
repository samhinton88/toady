const toady = require('../src');

const { makePage, base, PageProxy } = toady;

const initialiseState = (initialState) => (_, { signal }) =>  {
  if(signal !== 'init') return;

  return initialState;
}

const storeUrl = state => async (page, { signal }) => {
  if(signal !== 'storeUrl') return;

  return { ...state, url: await page.url() }
}

const goToGoogle = state => async(_p, { signal }, _rv, updateActions) => {
  if(signal !== 'goToGoogle') return;
  updateActions([{ type: 'goto', args: ['http://google.com'] }])

}

const logger = (state) => async (page, action, returnValue) => {
    const currentUrl = await page.url();
  
    console.log(`
      Page is at: ${currentUrl}
      after action of type: ${action.type}
      it returned ${returnValue ? returnValue : 'nothing'}
      state is: ${state}
    `);


  }

class TestPage extends PageProxy {};

describe('toady',() => {
  let app, instance, initState = {};
  const testProc = { type: 'goto', args: ['https://www.bbc.co.uk/radio4'] };

  beforeEach(async() => {
    instance = await makePage(TestPage, { headless: false });
    app = base(instance);
  });

  describe('middleware', () => {
    it('has access to state', async () => {
      await app([
        testProc, 
        { type: 'waitFor', args: [1], signal: 'end' },
        { type: 'close', args: [] }
      ])
        ((state) => (_, { signal }) => {
          if(signal !== 'end') return;

          expect(state).not.toBeUndefined();
        })
    })
    it('can update state', async () => {
      await app([
          testProc, 
          { type: 'waitFor', args: [1], signal: 'storeUrl' },
          { type: 'waitFor', args: [1], signal: 'end' },
          { type: 'close', args: [] }
        ])(storeUrl,(state) => (_, { signal }) => {
          if(signal !== 'end') return;
          
          expect(state.url).not.toBeUndefined();
      })
    });
    it('should allow initial state to be passed in', async () => {
      const stateToPassIn = { message: 'Hello' }
      await app([
        testProc, 
        { type: 'waitFor', args: [1], signal: 'end' },
        { type: 'close', args: [] }
      ], stateToPassIn)
      (
        (state) => (_, { signal }) => {
          if(signal !== 'end') return;
          
          expect(state).toEqual(stateToPassIn);
      });
  
    })

    it('should update state in a non-mutative way', async () => {
      await app([
          testProc, 
          { type: 'waitFor', args: [1], signal: 'storeUrl' },
          { type: 'waitFor', args: [1], signal: 'end' },
          { type: 'close', args: [] }
        ], initState)(storeUrl);
      
      expect(initState).toEqual({ });
    });

    fit('can extend the action array', async () => {
      await app([
        testProc, 
        { type: 'waitFor', args: [1], signal: 'goToGoogle' },
        { type: 'waitFor', args: [1], signal: 'storeUrl' },
        { type: 'waitFor', args: [1], signal: 'end' },
        { type: 'close', args: [] }
      ], initState)
      (
        [
          goToGoogle, 
          storeUrl,
          (
            (state) => (_, { signal }) => {
              if(signal !== 'end') return;
              
              expect(state.url).toEqual("http://google.com");
          })
        ]
      );
   

    })
  })

})