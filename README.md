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

## Actions

You can think of toady actions as being a little like HTML, except that, rather than describing the structure of of a page, they describe the structure of user decisions through time.

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

## State 

Toady carries a state object with it on its journey, it's best described in conjuction with Toady middleware. 

## Middleware 

You can think of middleware as the mind of the user, inspecting elements, making assumptions and making decisions.

We'll see that actions are the outcome of those decisions.

Middleware is passed into the final call as either a single function or an array of functions.

```js
await myToady(myActions)(myMiddleware); // myMiddleware could be an array or a single function
```

Middleware has this signature:

```js
const middleWare = state => async (pageInstance, action, returnValue, addActionsCb) => {
  // whatever you want to acheive with the middleware.
};
```

The functions will be called immediately after each action, the order that they are passed.

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

await app([triggerAction])(middleWare);
```

Through the `state` parameter, we have access to the state object.

If the middleware function returns a value, that value will replace the state object being carried along by Toady.




Middleware, therefore, becomes the primary way we can read and update any concept of state we hold on to as our toady processes its instructions. 

Updates to state should be immutable, and follow a reducer-like pattern which will be familiar to the users of the popular Redux state management library.

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

We can give a toady an initial state, which avoids us having to check state shape in the body of the middleware as I have done above:

```js
const initialState = { urls: [] };

const storeUrlAfterNav = s => async (p, a) => (
  a.type === 'goto' && { ...s, urls: [...s.urls, await p.url()] }
);

await app(steps, initialState)([storeUrlAfterNav]);
```
### Using Middleware to Add Actions

Middleware is able to add to the flow of actions through a callback which is the last argument in the middleware signature.

You might be tempted to handle the addition of user interactions using the middleware's access to the page object directly, however this is not the intended approach.

```js
//bad
const googleThenComeBack = state => async (pageObject, action, output) => {
	const termToSearch = state.termIPickedUpEarlier;
	await pageObject.goto('http://google.com');
	await pageObject.waitFor(googleSearchSelector);
	await pageObject.type(googleSearchSelector, termToSearch);
	await pageObject.myMethodToScrapeResultsPage();
	await pageObject.goto('https://www.myhomepage.com');
}

// good
const googleThenComeBack = state => (_p, _a, _o, updateActionCb) => {
	const termToSearch = state.termIPickedUpEarlier;
	updateActionCb(
		[
			{ type: 'goto', args: ['http://google.com'] },
			{ type: 'awaitAndType', args: [googleSearchSelector, termToSearch] },
			{ type: 'waitFor', args: [1], signal: 'scrapeResultsPage' },
			{ type: 'goto', args: ['https://myhomepage.com'] }
		]);
};
```

We can see that middleware can navigate by calling methods on the page object directly, but this would break the separation of concerns. 

By using the `updateActionCb` we are injecting actions into the normal flow, recording them as part of the history, and maintaining a separation between the _structure_ of our flow through an app and the _derived logic_ that we are applying to it.

You could think of the first approach as being like our middleware-mind engaging in day-dreaming, its thoughts and decisions not being _acted on_ insofar as that is understood by Toady.


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

