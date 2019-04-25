const injectAction = (arr) => (cb) => (index) => (actionsToAdd) => {

  cb([
    ...arr.slice(0, index+1), 
    ...actionsToAdd, 
    ...arr.slice(index,)
  ])
}

module.exports = (pageObject) => (pageImplementation, initState) => async (instruction, runPre, runPost) => {
  let state = initState || {}, newState;

  let actions = pageImplementation;
  const history = [];


  // loop over processes
  for (let i=0; i<actions.length; i++) {
    const action = actions[i];
    const updateActionCb = injectAction(actions)((newActions) => actions = newActions)(i);

    if (!action.args) action.args = [];

    // TODO: handle pre hooks or middleware [runPre]

    // run granular process
    // handle the case where an action must pass its result to the next process
    let output;

    if (action.shouldReturn) {

      output = await pageObject[action.type].apply(pageObject, action.args);

      // pass result on to the arguments of the next process
      if (pageImplementation[i + 1]) {

        pageImplementation[i + 1].args.push(output);

      }
      
    } else {

      await pageObject[action.type].apply(pageObject, action.args)

    }

    history.push(action);

    if (!pageImplementation[i+1]) { return output }

    if (!instruction) { continue };

    // pass process off to dev instruction
    // handle the case where the dev has passed an array of instructions
    if (Array.isArray(instruction)) {

      for(let j=0; j<instruction.length; j++) {

        newState = await instruction[j](state)(pageObject, action, output, updateActionCb);

        if(newState) {
          state = newState;
        }
        
      }

    } else {

      newState = await instruction(state)(pageObject, action, output, updateActionCb);

      if(newState) {
        state = newState
      }

    }
    // TODO handle post hooks or middleware [runPost]
  }
}