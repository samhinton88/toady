module.exports = (pageObject) => (pageImplementation) => async (instruction, runPre, runPost) => {

    // loop over processes
    for (let i=0; i<pageImplementation.length; i++) {
      const action = pageImplementation[i];
  
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
  
      if (!pageImplementation[i+1]) { return output }
  
      if (!instruction) { continue };
  
      // pass process off to dev instruction
      // handle the case where the dev has passed an array of instructions
      if (Array.isArray(instruction)) {
  
        for(let j=0; j<instruction.length; j++) {
  
          await instruction[j](pageObject, action, output);
          
        }
  
      } else {
  
        await instruction(pageObject, action, output);
  
      }
      // TODO handle post hooks or middleware [runPost]
    }
  }