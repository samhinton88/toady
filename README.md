[![npm version](https://badge.fury.io/js/toady.svg)](https://badge.fury.io/js/toady)
# toady

## Installation

With npm:

```shell 
> npm install --save toady
```

## Anatomy

A toady is born from *Actions*, *State* and *Middleware*.

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
`makePage` takes a [class which extends PageProxy](#proxy) as its first argument, and either a boolean  or an object as its second. When the second argument is a `boolean`, it indicates whether or not the toady should run headlessly. This function returns our puppeteer page object.

## Actions

You can think of toady actions as being a little like HTML, but rather than describing the structure of of a page, they describe the structure of user decisions through time.

The minimum an action needs to send instructions to the Page object is a `type`, which corresponds to a method name which the page / browser instance can respond to. 

Frequently you'll want to pass along arguments too - you can do this in an array on the `args` key.

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

The structure of these actions is intentionally rustic, and a dev might wish to wrap these objects into functions to return them.

```js
const linger = () => ({ type: 'waitFor', args: [5000] })
const goTo = url => ({ type: 'goto', args: [url]})

const logIn = ({ user, password }) => (
  [
    { type: 'awaitAndType', args:[userNameSelector, user] },
    { type: 'awaitAndType', args:[passwordSelector, password] },
    { type: 'awaitAndClick', args:[submitSelector] },
  ]
);

await base([goTo(myUrl), ...logIn({ password: 'password', user: 'me123' }), linger()])();
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

The functions will be called immediately after each action, in the order that they are passed.

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

An array of actions passed to the callback will be inserted into the sequence of actions, meaning that, once any additional actions are carried out, the engine will return to where it left off in the original sequence.

```js
// given that:
const originalActions = [a1, a2, a3, a4, a5, a6];

cb([b1, b2, b3])

// will result in:
[a1, a2, a3, ...[b1, b2, b3], a4, a5, a6];
```

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
    ]
  );
};
```
We can see that middleware can navigate by calling methods on the page object directly, but this would break the separation of concerns. 

By using the `updateActionCb` we are injecting actions into the normal flow, recording them as part of the history, and maintaining a separation between the _structure_ of our flow through an app and the _derived logic_ that we are applying to it.

You could think of the first approach as being like our middleware-mind engaging in day-dreaming, its thoughts and decisions not being _acted on_ insofar as that is understood by Toady.

You can see that middleware can serve as a way to change the flow of your Toady, based on logical gates:

```js
const scrapeIfResourceExists = s => async (p, _a, _o, update) => {
  if (await p.title() === '404 - page not found') update(actionsIf404);return;

  update(actionsIfNot404);
}
```

Here's an example that demos a kind of recursive pattern:

```js
const scrapeAllATags = s => async (p, a, _, update) => {
  if(a.signal !== 'scrapeAllATags') return;
  const hrefs = await p.evaluate(() => [...document.querySelectorAll('a').map(t => t.href)]);
  const actions = hrefs.reduce((acc, href) => {
    return [...acc, 
      { type: 'goto', args: [href] },
      { type: 'waitFor', args: [1], signal: 'scrapeAllATags' }
    ]
  }, []);

  update(actions);

  return { ...s, hrefs: [...s.hrefs, ...hrefs] };
}
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

