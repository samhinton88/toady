# toady

Toady is a wrapper around the puppeteer framework for making bots, named after [this](https://en.wikipedia.org/wiki/Sycophancy).


## Installation

With npm:

```shell 
> npm install --save toady
```

## Usage

Send a toady to the [BBC homepage](https://www.bbc.co.uk/):

```js
const toady = require('toady');

(async () => {
    const { makePage, base, proxy } = toady;

    const testProc = { type: 'goto', args: ['https://www.bbc.co.uk/'] };
    
    class BBCPage extends proxy {};
    
    const instance = await makePage(BBCPage, false);
    
    const app = base(instance);
    
    await app([testProc, { type: 'close' }])();
})();

```

## The Proxy

You can add commands of your own, on top of those I've added to the regular Puppeteer API.

```js
class MyPage extends proxy {

  goHomeAndSayWhy = reason => {
    this.page.goto('https://www.mypage.io');
    this.log(`Because ${reason}`);
  }
}

const instance = await makePage(MyPage, false);
const app(instance); // <-- will now understand { type: 'goHomeAndSayWhy', args: ["I'm tired"] }

```

## Middleware 

Additional functions may be passed into your toady and act as middleware.

Toady middleware takes the signature:

```js
const middleWare = (pageInstance, action, returnValue) => {};
```

The functions will be called immediately after each action.

```js
const logger = async (page, action, returnValue) => {
  const currentUrl = await page.url();

  console.log(`
    Page is at: ${currentUrl}
    after action of type: ${action.type}
    it returned ${returnValue ? returnValue : 'nothing'}
  `);
}
```

Running the above should log:

```shell
      Page is at: https://www.bbc.co.uk/radio4
      after action of type: goto
      it returned nothing

```

It may make sense for your toady to trigger middleware for particular actions only.

```js
const triggerAction = { type: 'goto', args: ['https://whatever.io'], signal: 'do middleware!' }

const middleWare = (page, action) => {
  if(action.signal !== 'do middleware!') return;

  // Do the work of the middleware... 
}
```