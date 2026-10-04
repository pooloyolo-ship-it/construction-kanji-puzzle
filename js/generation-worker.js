import {generateProblem} from './generator.js';
self.onmessage=e=>{const {token,mode,dictionary,options}=e.data;try{self.postMessage({token,stage:generateProblem(mode,dictionary,options)});}catch(error){self.postMessage({token,error:error.message});}};
