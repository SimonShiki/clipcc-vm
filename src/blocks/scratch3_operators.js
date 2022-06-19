const Cast = require('../util/cast.js');
const MathUtil = require('../util/math-util.js');

class Scratch3OperatorsBlocks {
    constructor (runtime) {
        /**
         * The runtime instantiating this block package.
         * @type {Runtime}
         */
        this.runtime = runtime;
    }

    /**
     * Retrieve the block primitives implemented by this package.
     * @return {object.<string, Function>} Mapping of opcode to Function.
     */
    getPrimitives () {
        return {
            operator_add: this.add,
            operator_subtract: this.subtract,
            operator_multiply: this.multiply,
            operator_divide: this.divide,
            operator_lt: this.lt,
            operator_equals: this.equals,
            operator_gt: this.gt,
            operator_and: this.and,
            operator_or: this.or,
            operator_not: this.not,
            operator_random: this.random,
            operator_join: this.join,
            operator_join_advanced: this.joinAdvanced,
            operator_indexof: this.indexOf,
            operator_letter_of: this.letterOf,
            operator_length: this.length,
            operator_contains: this.contains,
            operator_mod: this.mod,
            operator_round: this.round,
            operator_mathop: this.mathop,

            operator_power: this.power,
            operator_bitand: this.bitand,
            operator_bitor: this.bitor,
            operator_bitxor: this.bitxor,
            operator_bitnot: this.bitnot,
            operator_bitlsh: this.bitlsh,
            operator_bitrsh: this.bitrsh,
            operator_bitursh: this.bitursh,
            operator_le: this.le,
            operator_ge: this.ge,
            operator_nequals: this.nequals
        };
    }

    add (args) {
        return Cast.toNumber(args.NUM1) + Cast.toNumber(args.NUM2);
    }

    subtract (args) {
        return Cast.toNumber(args.NUM1) - Cast.toNumber(args.NUM2);
    }

    multiply (args) {
        return Cast.toNumber(args.NUM1) * Cast.toNumber(args.NUM2);
    }

    divide (args) {
        return Cast.toNumber(args.NUM1) / Cast.toNumber(args.NUM2);
    }

    lt (args) {
        return Cast.compare(args.OPERAND1, args.OPERAND2) < 0;
    }

    equals (args) {
        return Cast.compare(args.OPERAND1, args.OPERAND2) === 0;
    }

    gt (args) {
        return Cast.compare(args.OPERAND1, args.OPERAND2) > 0;
    }

    and (args) {
        return Cast.toBoolean(args.OPERAND1) && Cast.toBoolean(args.OPERAND2);
    }

    or (args) {
        return Cast.toBoolean(args.OPERAND1) || Cast.toBoolean(args.OPERAND2);
    }

    not (args) {
        return !Cast.toBoolean(args.OPERAND);
    }

    random (args) {
        const nFrom = Cast.toNumber(args.FROM);
        const nTo = Cast.toNumber(args.TO);
        const low = nFrom <= nTo ? nFrom : nTo;
        const high = nFrom <= nTo ? nTo : nFrom;
        if (low === high) return low;
        // If both arguments are ints, truncate the result to an int.
        if (Cast.isInt(args.FROM) && Cast.isInt(args.TO)) {
            return low + Math.floor(Math.random() * ((high + 1) - low));
        }
        return (Math.random() * (high - low)) + low;
    }

    join (args) {
        return Cast.toString(args.STRING1) + Cast.toString(args.STRING2);
    }

    joinAdvanced (args) {
        let result = '';
        const ids = JSON.parse(args.mutation.argumentids);
        for (const id of ids) {
            result += Cast.toString(args[id]);
        }
        return result;
    }

    indexOf (args) {
        const {STRING, SUBSTRING, POS} = args;
        let index = STRING.indexOf(SUBSTRING);
        if (index === -1) return -1;
        for (let i = 0; i < Number(POS) - 1; i++) {
            index = STRING.indexOf(SUBSTRING, index + 1);
            if (index === -1) return -1;
        }
        return index + 1;
    }

    letterOf (args) {
        const index = Cast.toNumber(args.LETTER) - 1;
        const str = Cast.toString(args.STRING);
        // Out of bounds?
        if (index < 0 || index >= str.length) {
            return '';
        }
        return str.charAt(index);
    }

    length (args) {
        return Cast.toString(args.STRING).length;
    }

    contains (args) {
        const format = function (string) {
            return Cast.toString(string).toLowerCase();
        };
        return format(args.STRING1).includes(format(args.STRING2));
    }

    mod (args) {
        const n = Cast.toNumber(args.NUM1);
        const modulus = Cast.toNumber(args.NUM2);
        let result = n % modulus;
        // Scratch mod uses floored division instead of truncated division.
        if (result / modulus < 0) result += modulus;
        return result;
    }

    round (args) {
        return Math.round(Cast.toNumber(args.NUM));
    }

    mathop (args) {
        const operator = Cast.toString(args.OPERATOR).toLowerCase();
        const n = Cast.toNumber(args.NUM);
        switch (operator) {
        case 'abs': return Math.abs(n);
        case 'floor': return Math.floor(n);
        case 'ceiling': return Math.ceil(n);
        case 'sqrt': return Math.sqrt(n);
        case 'sin': return parseFloat(Math.sin((Math.PI * n) / 180).toFixed(10));
        case 'cos': return parseFloat(Math.cos((Math.PI * n) / 180).toFixed(10));
        case 'tan': return MathUtil.tan(n);
        case 'asin': return (Math.asin(n) * 180) / Math.PI;
        case 'acos': return (Math.acos(n) * 180) / Math.PI;
        case 'atan': return (Math.atan(n) * 180) / Math.PI;
        case 'ln': return Math.log(n);
        case 'log': return Math.log(n) / Math.LN10;
        case 'e ^': return Math.exp(n);
        case '10 ^': return Math.pow(10, n);
        }
        return 0;
    }

    power (args) {
        return Math.pow(Cast.toNumber(args.NUM1), Cast.toNumber(args.NUM2));
    }

    bitand (args) {
        return Cast.toNumber(args.NUM1) & Cast.toNumber(args.NUM2);
    }

    bitor (args) {
        return Cast.toNumber(args.NUM1) | Cast.toNumber(args.NUM2);
    }

    bitxor (args) {
        return Cast.toNumber(args.NUM1) ^ Cast.toNumber(args.NUM2);
    }

    bitlsh (args) {
        return Cast.toNumber(args.NUM1) << Cast.toNumber(args.NUM2);
    }

    bitrsh (args) {
        return Cast.toNumber(args.NUM1) >> Cast.toNumber(args.NUM2);
    }

    bitursh (args) {
        return Cast.toNumber(args.NUM1) >>> Cast.toNumber(args.NUM2);
    }

    bitnot (args) {
        return ~Cast.toNumber(args.NUM1);
    }

    ge (args) {
        return Cast.compare(args.OPERAND1, args.OPERAND2) >= 0;
    }

    le (args) {
        return Cast.compare(args.OPERAND1, args.OPERAND2) <= 0;
    }

    nequals (args) {
        return Cast.compare(args.OPERAND1, args.OPERAND2) !== 0;
    }

    gcd (args) {
        return MathUtil.gcd(Cast.toNumber(args.NUM1), Cast.toNumber(args.NUM2));
    }

    lcm (args) {
        return MathUtil.lcm(Cast.toNumber(args.NUM1), Cast.toNumber(args.NUM2));
    }
}

module.exports = Scratch3OperatorsBlocks;
