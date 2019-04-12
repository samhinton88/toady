const toady = require('../src');

const logger = async (page, action, returnValue) => {
    const currentUrl = await page.url();
  
    console.log(`
      Page is at: ${currentUrl}
      after action of type: ${action.type}
      it returned ${returnValue ? returnValue : 'nothing'}
    `);
  }


const build = async () => { 
    const { makePage, base, Proxy } = toady;
    
    const testProc = { type: 'goto', args: ['https://www.bbc.co.uk/radio4'] };
    
    class TestPage extends Proxy {};
    
    const instance = await makePage(TestPage, false);
    
    return base(instance)([testProc, { type: 'close' }]);
};

describe('engine',() => {
    it('accepts middleware', async () => {
      const app = await build();

      await app(logger);
    })
})