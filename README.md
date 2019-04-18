[![npm version](https://badge.fury.io/js/toady.svg)](https://badge.fury.io/js/toady)
# toady

Toady helps you build bots by providing a part-wrapper, part-engine for the [puppeteer](https://github.com/GoogleChrome/puppeteer) framework.

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
    const { makePage, base, PageProxy } = toady;

    const testProc = { type: 'goto', args: ['https://www.bbc.co.uk/'] };
    
    class BBCPage extends PageProxy {};
    
    const instance = await makePage(BBCPage, false);
    
    const app = base(instance);
    
    await app([testProc, { type: 'close' }])();
})();

```
`makePage` takes a [class which extends PageProxy](#proxy) as its first argument, and a boolean to set whether or not it should run headlessly as its second.

`base` then consumes that page instance into an engine which makes use of a technique known as [inversion of control](https://en.wikipedia.org/wiki/Inversion_of_control), to pass sequences of commands (actions) to the Page object.

The minimum an action needs to send instructions to the Page object is a `type`, though frequently you'll want to pass along arguments too - you can do this in an array on the `args` key.

```js
{ type: String, args: [String|Number|Boolean|Function] }
```

You can send along any method call that is known by the Page and Browser objects in the Puppeteer library. I have included a number of additional helpers on top of this API.

For instance: 
```js
// this:
[
  { type: 'waitFor', args: ['.some-selector'] }, 
  { type: 'click', args: ['.some-selector'] }
]
// can be achieved with this:
[{ type: 'awaitAndClick', args: ['.some-selector'] }]
```


## Middleware 

Additional functions may be passed into your toady and act as middleware.

Toady middleware takes the signature:

```js
const middleWare = state => async (pageInstance, action, returnValue) => {};
```

The functions will be called immediately after each action.

```js
const logger = () => async (page, action, returnValue) => {
  const currentUrl = await page.url();

  console.log(`
    Page is at: ${currentUrl}
    after action of type: ${action.type}
    it returned ${returnValue ? returnValue : 'nothing'}
  `);
};

await app([testProc, { type: 'close' }])(logger);
```

Running the above should log:

```shell
      Page is at: https://www.bbc.co.uk/radio4
      after action of type: goto
      it returned nothing
```

It may make sense for your toady to trigger middleware for particular actions only.

A reasonable way of achieving this might be:

```js
const triggerAction = { type: 'goto', args: ['https://whatever.io'], signal: 'do middleware!' }

const middleWare = () => (page, action) => {
  if(action.signal !== 'do middleware!') return;

  // Do the work of the middleware... 
};

await app(processArray)(middleWare);
```

You can also pass a toady an array of middleware functions, and it will run them in turn.

```js
await app([testProc, { type: 'close' }])([logger, screenShotOnPageChange, someotherMiddleware]);

```
Through the `state` parameter, we have access to an object on which we can store data as the toady progresses through the sequence.

Middleware, therefore, becomes the primary way we can read and update any concept of state we hold on to as our toady processes its instructions.

```js
const storeUrlAfterNav = state => async (page, action) => {
  if(action.type !== 'goto') return;
  
  const url = await page.url();

  if(!state.urls) {
    return { ...state, urls: [url] };
  }

  return { ...state, urls: [...state.urls, url] };
};
```

We can give a toady an initial state, which avoids us having to check state shape in the body of the middleware as I have done above.

```js
const initialState = { urls: [] };

const storeUrlAfterNav = s => async (p, a) => (
  a.type === 'goto' && { ...s, urls: [...s.urls, await p.url()] }
);

await app(steps, initialState)([storeUrlAfterNav]);
```

## <a name="proxy">The PageProxy</a>

You can add commands of your own on top of those I've added to the regular Puppeteer API. 

```js
class MyPage extends PageProxy {

  goHomeAndSayWhy = reason => {
    this.page.goto('https://www.mypage.io');
    this.log(`Because ${reason}`);
  }
}

const instance = await makePage(MyPage, false);
const app(instance); // <-- will now understand { type: 'goHomeAndSayWhy', args: ["I'm tired"] }

```
The page object will be available to you within your class at `this.page`.

## Passing Return values between actions 

It may be useful to pass the return value from one action to the arguments of the next.

If I want my toady to find some href from a page and then go to it, I could pass in a custom page class with this method:

```js
class MyPage extends PageProxy {

  getLinkHref = selector => {
    return this.page.evaluate(
      // logic to get href
    , selector)
  }
}
```
And include in some sequence:
```js
const proc = [
  { type: 'getLinkHref', args:['#some-id'], shouldReturn: true},
  { type: 'goto' args: [] }  
] 
```
Because I pass in a `shouldReturn` key, my toady will pass the href collected from the first action, and push it into the arguments of the second.

