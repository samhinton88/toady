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
    
    app([testProc])();
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
