const toady = require('../src');

const { makePage, base, PageProxy } = toady;

const logger = async (page, action, returnValue) => {
    const currentUrl = await page.url();
  
    console.log(`
      Page is at: ${currentUrl}
      after action of type: ${action.type}
      it returned ${returnValue ? returnValue : 'nothing'}
    `);
  }

  class TestPage extends PageProxy {};



describe('toady',() => {
  let app, instance;
  const testProc = { type: 'goto', args: ['https://www.bbc.co.uk/radio4'] };

    describe('makepage', () => {
      it('accepts configuration to pass to the puppeteer object', async () => {
        instance = await makePage(TestPage, { headless: true });
        app = base(instance);
        await app([testProc, { type: 'close' }])(logger);
      });
      it('accepts configuration to configure window width and height', async () => {
        instance = await makePage(TestPage, { headless: false, width: 1200, height: 1000 });
        app = base(instance);
        await app([testProc, { type: 'close' }])(logger);
      });
      it('accepts a boolean as object configuration', async () => {
        instance = await makePage(TestPage, false);
        app = base(instance);
        await app([testProc, { type: 'close' }])(logger);
      })
    })
    it('accepts middleware', async () => {
      instance = await makePage(TestPage, { headless: false, width: 100, height: 100 });
      app = base(instance);
      await app([testProc, { type: 'close' }],logger);
    });
})