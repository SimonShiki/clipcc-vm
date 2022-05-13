const Compiler = require('../compiler/compiler');

/**
 * Recycle bin for empty stackFrame objects
 * @type Array<_StackFrame>
 */
const _stackFrameFreeList = [];

/**
 * A frame used for each level of the stack. A general purpose
 * place to store a bunch of execution context and parameters
 * @param {boolean} warpMode Whether this level of the stack is warping
 * @constructor
 * @private
 */
class _StackFrame {
    constructor (warpMode) {
        /**
         * Whether this level of the stack is a loop.
         * @type {boolean}
         */
        this.isLoop = false;

        /**
         * Whether this level is in warp mode.  Is set by some legacy blocks and
         * "turbo mode"
         * @type {boolean}
         */
        this.warpMode = warpMode;

        /**
         * Reported value from just executed block.
         * @type {Any}
         */
        this.justReported = null;

        /**
         * The active block that is waiting on a promise.
         * @type {string}
         */
        this.reporting = '';

        /**
         * Persists reported inputs during async block.
         * @type {Object}
         */
        this.reported = null;

        /**
         * Whether waiting a reporter.
         * @type {string}
         */
        this.waitingReporter = false;

        /**
         * Procedure parameters.
         * @type {Object}
         */
        this.params = null;

        /**
         * A context passed to block implementations.
         * @type {Object}
         */
        this.executionContext = null;
    }

    /**
     * Reset all properties of the frame to pristine null and false states.
     * Used to recycle.
     * @return {_StackFrame} this
     */
    reset () {

        this.isLoop = false;
        this.warpMode = false;
        this.justReported = null;
        this.reporting = '';
        this.reported = null;
        this.waitingReporter = false;
        this.params = null;
        this.executionContext = null;

        return this;
    }

    /**
     * Reuse an active stack frame in the stack.
     * @param {?boolean} warpMode defaults to current warpMode
     * @returns {_StackFrame} this
     */
    reuse (warpMode = this.warpMode) {
        this.reset();
        this.warpMode = Boolean(warpMode);
        return this;
    }

    /**
     * Create or recycle a stack frame object.
     * @param {boolean} warpMode Enable warpMode on this frame.
     * @returns {_StackFrame} The clean stack frame with correct warpMode setting.
     */
    static create (warpMode) {
        const stackFrame = _stackFrameFreeList.pop();
        if (typeof stackFrame !== 'undefined') {
            stackFrame.warpMode = Boolean(warpMode);
            return stackFrame;
        }
        return new _StackFrame(warpMode);
    }

    /**
     * Put a stack frame object into the recycle bin for reuse.
     * @param {_StackFrame} stackFrame The frame to reset and recycle.
     */
    static release (stackFrame) {
        if (typeof stackFrame !== 'undefined') {
            _stackFrameFreeList.push(stackFrame.reset());
        }
    }
}

/**
 * A thread is a running stack context and all the metadata needed.
 * @param {?string} firstBlock First block to execute in the thread.
 * @constructor
 */
class Thread {
    constructor (firstBlock, runtime) {
        /**
         * ID of top block of the thread
         * @type {!string}
         */
        this.topBlock = firstBlock;
        this.runtime = runtime;

        /**
         * Stack for the thread. When the sequencer enters a control structure,
         * the block is pushed onto the stack so we know where to exit.
         * @type {Array.<string>}
         */
        this.stack = [];

        this.targetChange = [];

        /**
         * Stack frames for the thread. Store metadata for the executing blocks.
         * @type {Array.<_StackFrame>}
         */
        this.stackFrames = [];

        /**
         * Status of the thread, one of three states (below)
         * @type {number}
         */
        this.status = 0; /* Thread.STATUS_RUNNING */

        /**
         * Whether the thread is killed in the middle of execution.
         * @type {boolean}
         */
        this.isKilled = false;

        /**
         * Target of this thread.
         * @type {?Target}
         */
        this.target = null;

        /**
         * Target stack of this thread.
         * @type {Array.<Target>}
         */
        this.targetStack = [];

        /**
         * The Blocks this thread will execute.
         * @type {Blocks}
         */
        this.blockContainer = null;

        /**
         * Compiled stack of thread.
         * @type {GeneratorFunction}
         */
        this.compiledStack = null;

        /**
         * Whether the thread is compiled.
         * @type {boolean}
         */
        this.isCompiled = false;

        /**
         * Whether the thread requests its script to glow during this frame.
         * @type {boolean}
         */
        this.requestScriptGlowInFrame = false;

        /**
         * Which block ID should glow during this frame, if any.
         * @type {?string}
         */
        this.blockGlowInFrame = null;

        /**
         * A timer for when the thread enters warp mode.
         * Substitutes the sequencer's count toward WORK_TIME on a per-thread basis.
         * @type {?Timer}
         */
        this.warpTimer = null;

        this.justReported = null;
    }

    /**
     * Thread status for initialized or running thread.
     * This is the default state for a thread - execution should run normally,
     * stepping from block to block.
     * @const
     */
    static get STATUS_RUNNING () {
        return 0;
    }

    /**
     * Threads are in this state when a primitive is waiting on a promise;
     * execution is paused until the promise changes thread status.
     * @const
     */
    static get STATUS_PROMISE_WAIT () {
        return 1;
    }

    /**
     * Thread status for yield.
     * @const
     */
    static get STATUS_YIELD () {
        return 2;
    }

    /**
     * Thread status for a single-tick yield. This will be cleared when the
     * thread is resumed.
     * @const
     */
    static get STATUS_YIELD_TICK () {
        return 3;
    }

    /**
     * Thread status for a finished/done thread.
     * Thread is in this state when there are no more blocks to execute.
     * @const
     */
    static get STATUS_DONE () {
        return 4;
    }

    /**
     * Push stack and update stack frames appropriately.
     * @param {string} blockId Block ID to push to stack.
     * @param {?Target} target Current target.
     */
    pushStack (blockId, target) {
        this.stack.push(blockId);
        if (target && this.target !== target) {
            this.pushTarget(target);
            this.targetChange.push(true);
        } else {
            this.targetChange.push(false);
        }
        // Push an empty stack frame, if we need one.
        // Might not, if we just popped the stack.
        if (this.stack.length > this.stackFrames.length) {
            const parent = this.stackFrames[this.stackFrames.length - 1];
            this.stackFrames.push(_StackFrame.create(typeof parent !== 'undefined' && parent.warpMode));
        }
    }

    pushTarget (target) {
        this.targetStack.push(this.target);
        this.target = target;
        this.blockContainer = this.target.blocks;
    }

    /**
     * Reset the stack frame for use by the next block.
     * (avoids popping and re-pushing a new stack frame - keeps the warpmode the same
     * @param {string} blockId Block ID to push to stack.
     */
    reuseStackForNextBlock (blockId) {
        this.stack[this.stack.length - 1] = blockId;
        this.stackFrames[this.stackFrames.length - 1].reuse();
    }

    /**
     * Pop last block on the stack and its stack frame.
     * @return {string} Block ID popped from the stack.
     */
    popStack () {
        _StackFrame.release(this.stackFrames.pop());
        if (this.targetChange.pop()) {
            this.popTarget();
        }
        return this.stack.pop();
    }

    popTarget () {
        this.target = this.targetStack.pop();
        this.blockContainer = this.target.blocks;
        return this.target;
    }

    /**
     * Pop back down the stack frame until we hit a procedure call or the stack frame is emptied
     */
    stopThisScript () {
        let blockID = this.peekStack();
        while (blockID !== null) {
            const block = this.target.blocks.getBlock(blockID);
            if (this.peekStackFrame().waitingReporter) {
                // cc - check if a reporter procedure is on the stack
                break;
            } else if (typeof block !== 'undefined' && block.opcode === 'procedures_call') {
                // cc - prevent call command procedure repeatedly
                this.goToNextBlock();
                break;
            }
            this.popStack();
            blockID = this.peekStack();
        }

        if (this.stack.length === 0) {
            // Clean up!
            this.requestScriptGlowInFrame = false;
            this.status = Thread.STATUS_DONE;
        }
    }

    /**
     * Get top stack item.
     * @return {?string} Block ID on top of stack.
     */
    peekStack () {
        return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
    }


    /**
     * Get top stack frame.
     * @return {?object} Last stack frame stored on this thread.
     */
    peekStackFrame () {
        return this.stackFrames.length > 0 ? this.stackFrames[this.stackFrames.length - 1] : null;
    }

    /**
     * Get stack frame above the current top.
     * @return {?object} Second to last stack frame stored on this thread.
     */
    peekParentStackFrame () {
        return this.stackFrames.length > 1 ? this.stackFrames[this.stackFrames.length - 2] : null;
    }

    /**
     * Get top stack target.
     * @return {?object} Last target.
     */
    peekTarget () {
        return this.targetStack.length > 1 ? this.targetStack[this.targetStack.length - 1] : null;
    }

    /**
     * Push a reported value to the parent of the current stack frame.
     * @param {*} value Reported value to push.
     */
    pushReportedValue (value) {
        this.justReported = typeof value === 'undefined' ? null : value;
    }

    /**
     * Initialize procedure parameters on this stack frame.
     */
    initParams () {
        const stackFrame = this.peekStackFrame();
        if (stackFrame.params === null) {
            stackFrame.params = {};
        }
    }

    /**
     * Add a parameter to the stack frame.
     * Use when calling a procedure with parameter values.
     * @param {!string} paramName Name of parameter.
     * @param {*} value Value to set for parameter.
     */
    pushParam (paramName, value) {
        const stackFrame = this.peekStackFrame();
        stackFrame.params[paramName] = value;
    }

    /**
     * Get a parameter at the lowest possible level of the stack.
     * @param {!string} paramName Name of parameter.
     * @return {*} value Value for parameter.
     */
    getParam (paramName) {
        for (let i = this.stackFrames.length - 2; i >= 0; i--) {
            const frame = this.stackFrames[i];
            if (frame.params === null) {
                continue;
            }
            if (frame.params.hasOwnProperty(paramName)) {
                return frame.params[paramName];
            }
            return null;
        }
        return null;
    }

    /**
     * Whether the current execution of a thread is at the top of the stack.
     * @return {boolean} True if execution is at top of the stack.
     */
    atStackTop () {
        return this.peekStack() === this.topBlock;
    }


    /**
     * Switch the thread to the next block at the current level of the stack.
     * For example, this is used in a standard sequence of blocks,
     * where execution proceeds from one block to the next.
     */
    goToNextBlock () {
        const nextBlockId = this.target.blocks.getNextBlock(this.peekStack());
        this.reuseStackForNextBlock(nextBlockId);
    }

    /**
     * Attempt to determine whether a procedure call is recursive,
     * by examining the stack.
     * @param {!string} procedureCode Procedure code of procedure being called.
     * @return {boolean} True if the call appears recursive.
     */
    isRecursiveCall (procedureCode) {
        let callCount = 5; // Max number of enclosing procedure calls to examine.
        const sp = this.stack.length - 1;
        let flag = false;
        for (let i = sp - 1; i >= 0; i--) {
            let blockId = this.stack[i];
            // cc - that the flag is set means the stack has been checked, otherwise it should be checked first.
            if (!flag && this.stackFrames[i].waitingReporter) {
                blockId = this.stackFrames[i].reporting;
                flag = true;
                ++i;
            } else {
                flag = false;
            }
            let block = this.target.blocks.getBlock(blockId);
            if (!block) { // This block is not in current sprite.
                // todo: optimize iff the stack only be pushed when a procedure is called.
                for (const target of this.runtime.targets) {
                    block = target.blocks.getBlock(blockId);
                    if (block) break;
                }
            }
            if (!block) {
                return false;
            }
            if ((block.opcode === 'procedures_call' || block.opcode === 'procedures_call_return') &&
                block.mutation.proccode === procedureCode) {
                return true;
            }
            if (--callCount < 0) {
                return false;
            }
        }
        return false;
    }

    // --------------------------
    compile () {
        if (!this.isCompiled) {
            try {
                const compiler = new Compiler(this);
                this.compiledStack = compiler.generateStack(this.topBlock);
                console.log(this.compiledStack);
                this.isCompiled = true;
            } catch (e) {
                console.log(`Error occurred during compilation:\n ${e}`);
            }
        }
    }
}

module.exports = Thread;
