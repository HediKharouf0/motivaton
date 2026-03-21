import {
    Cell,
    Slice,
    Address,
    Builder,
    beginCell,
    ComputeError,
    TupleItem,
    TupleReader,
    Dictionary,
    contractAddress,
    address,
    ContractProvider,
    Sender,
    Contract,
    ContractABI,
    ABIType,
    ABIGetter,
    ABIReceiver,
    TupleBuilder,
    DictionaryValue
} from '@ton/core';

export type DataSize = {
    $$type: 'DataSize';
    cells: bigint;
    bits: bigint;
    refs: bigint;
}

export function storeDataSize(src: DataSize) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.cells, 257);
        b_0.storeInt(src.bits, 257);
        b_0.storeInt(src.refs, 257);
    };
}

export function loadDataSize(slice: Slice) {
    const sc_0 = slice;
    const _cells = sc_0.loadIntBig(257);
    const _bits = sc_0.loadIntBig(257);
    const _refs = sc_0.loadIntBig(257);
    return { $$type: 'DataSize' as const, cells: _cells, bits: _bits, refs: _refs };
}

export function loadTupleDataSize(source: TupleReader) {
    const _cells = source.readBigNumber();
    const _bits = source.readBigNumber();
    const _refs = source.readBigNumber();
    return { $$type: 'DataSize' as const, cells: _cells, bits: _bits, refs: _refs };
}

export function loadGetterTupleDataSize(source: TupleReader) {
    const _cells = source.readBigNumber();
    const _bits = source.readBigNumber();
    const _refs = source.readBigNumber();
    return { $$type: 'DataSize' as const, cells: _cells, bits: _bits, refs: _refs };
}

export function storeTupleDataSize(source: DataSize) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.cells);
    builder.writeNumber(source.bits);
    builder.writeNumber(source.refs);
    return builder.build();
}

export function dictValueParserDataSize(): DictionaryValue<DataSize> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeDataSize(src)).endCell());
        },
        parse: (src) => {
            return loadDataSize(src.loadRef().beginParse());
        }
    }
}

export type SignedBundle = {
    $$type: 'SignedBundle';
    signature: Buffer;
    signedData: Slice;
}

export function storeSignedBundle(src: SignedBundle) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBuffer(src.signature);
        b_0.storeBuilder(src.signedData.asBuilder());
    };
}

export function loadSignedBundle(slice: Slice) {
    const sc_0 = slice;
    const _signature = sc_0.loadBuffer(64);
    const _signedData = sc_0;
    return { $$type: 'SignedBundle' as const, signature: _signature, signedData: _signedData };
}

export function loadTupleSignedBundle(source: TupleReader) {
    const _signature = source.readBuffer();
    const _signedData = source.readCell().asSlice();
    return { $$type: 'SignedBundle' as const, signature: _signature, signedData: _signedData };
}

export function loadGetterTupleSignedBundle(source: TupleReader) {
    const _signature = source.readBuffer();
    const _signedData = source.readCell().asSlice();
    return { $$type: 'SignedBundle' as const, signature: _signature, signedData: _signedData };
}

export function storeTupleSignedBundle(source: SignedBundle) {
    const builder = new TupleBuilder();
    builder.writeBuffer(source.signature);
    builder.writeSlice(source.signedData.asCell());
    return builder.build();
}

export function dictValueParserSignedBundle(): DictionaryValue<SignedBundle> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeSignedBundle(src)).endCell());
        },
        parse: (src) => {
            return loadSignedBundle(src.loadRef().beginParse());
        }
    }
}

export type StateInit = {
    $$type: 'StateInit';
    code: Cell;
    data: Cell;
}

export function storeStateInit(src: StateInit) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeRef(src.code);
        b_0.storeRef(src.data);
    };
}

export function loadStateInit(slice: Slice) {
    const sc_0 = slice;
    const _code = sc_0.loadRef();
    const _data = sc_0.loadRef();
    return { $$type: 'StateInit' as const, code: _code, data: _data };
}

export function loadTupleStateInit(source: TupleReader) {
    const _code = source.readCell();
    const _data = source.readCell();
    return { $$type: 'StateInit' as const, code: _code, data: _data };
}

export function loadGetterTupleStateInit(source: TupleReader) {
    const _code = source.readCell();
    const _data = source.readCell();
    return { $$type: 'StateInit' as const, code: _code, data: _data };
}

export function storeTupleStateInit(source: StateInit) {
    const builder = new TupleBuilder();
    builder.writeCell(source.code);
    builder.writeCell(source.data);
    return builder.build();
}

export function dictValueParserStateInit(): DictionaryValue<StateInit> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeStateInit(src)).endCell());
        },
        parse: (src) => {
            return loadStateInit(src.loadRef().beginParse());
        }
    }
}

export type Context = {
    $$type: 'Context';
    bounceable: boolean;
    sender: Address;
    value: bigint;
    raw: Slice;
}

export function storeContext(src: Context) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.bounceable);
        b_0.storeAddress(src.sender);
        b_0.storeInt(src.value, 257);
        b_0.storeRef(src.raw.asCell());
    };
}

export function loadContext(slice: Slice) {
    const sc_0 = slice;
    const _bounceable = sc_0.loadBit();
    const _sender = sc_0.loadAddress();
    const _value = sc_0.loadIntBig(257);
    const _raw = sc_0.loadRef().asSlice();
    return { $$type: 'Context' as const, bounceable: _bounceable, sender: _sender, value: _value, raw: _raw };
}

export function loadTupleContext(source: TupleReader) {
    const _bounceable = source.readBoolean();
    const _sender = source.readAddress();
    const _value = source.readBigNumber();
    const _raw = source.readCell().asSlice();
    return { $$type: 'Context' as const, bounceable: _bounceable, sender: _sender, value: _value, raw: _raw };
}

export function loadGetterTupleContext(source: TupleReader) {
    const _bounceable = source.readBoolean();
    const _sender = source.readAddress();
    const _value = source.readBigNumber();
    const _raw = source.readCell().asSlice();
    return { $$type: 'Context' as const, bounceable: _bounceable, sender: _sender, value: _value, raw: _raw };
}

export function storeTupleContext(source: Context) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.bounceable);
    builder.writeAddress(source.sender);
    builder.writeNumber(source.value);
    builder.writeSlice(source.raw.asCell());
    return builder.build();
}

export function dictValueParserContext(): DictionaryValue<Context> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeContext(src)).endCell());
        },
        parse: (src) => {
            return loadContext(src.loadRef().beginParse());
        }
    }
}

export type SendParameters = {
    $$type: 'SendParameters';
    mode: bigint;
    body: Cell | null;
    code: Cell | null;
    data: Cell | null;
    value: bigint;
    to: Address;
    bounce: boolean;
}

export function storeSendParameters(src: SendParameters) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.mode, 257);
        if (src.body !== null && src.body !== undefined) { b_0.storeBit(true).storeRef(src.body); } else { b_0.storeBit(false); }
        if (src.code !== null && src.code !== undefined) { b_0.storeBit(true).storeRef(src.code); } else { b_0.storeBit(false); }
        if (src.data !== null && src.data !== undefined) { b_0.storeBit(true).storeRef(src.data); } else { b_0.storeBit(false); }
        b_0.storeInt(src.value, 257);
        b_0.storeAddress(src.to);
        b_0.storeBit(src.bounce);
    };
}

export function loadSendParameters(slice: Slice) {
    const sc_0 = slice;
    const _mode = sc_0.loadIntBig(257);
    const _body = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _code = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _data = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _value = sc_0.loadIntBig(257);
    const _to = sc_0.loadAddress();
    const _bounce = sc_0.loadBit();
    return { $$type: 'SendParameters' as const, mode: _mode, body: _body, code: _code, data: _data, value: _value, to: _to, bounce: _bounce };
}

export function loadTupleSendParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _code = source.readCellOpt();
    const _data = source.readCellOpt();
    const _value = source.readBigNumber();
    const _to = source.readAddress();
    const _bounce = source.readBoolean();
    return { $$type: 'SendParameters' as const, mode: _mode, body: _body, code: _code, data: _data, value: _value, to: _to, bounce: _bounce };
}

export function loadGetterTupleSendParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _code = source.readCellOpt();
    const _data = source.readCellOpt();
    const _value = source.readBigNumber();
    const _to = source.readAddress();
    const _bounce = source.readBoolean();
    return { $$type: 'SendParameters' as const, mode: _mode, body: _body, code: _code, data: _data, value: _value, to: _to, bounce: _bounce };
}

export function storeTupleSendParameters(source: SendParameters) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.mode);
    builder.writeCell(source.body);
    builder.writeCell(source.code);
    builder.writeCell(source.data);
    builder.writeNumber(source.value);
    builder.writeAddress(source.to);
    builder.writeBoolean(source.bounce);
    return builder.build();
}

export function dictValueParserSendParameters(): DictionaryValue<SendParameters> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeSendParameters(src)).endCell());
        },
        parse: (src) => {
            return loadSendParameters(src.loadRef().beginParse());
        }
    }
}

export type MessageParameters = {
    $$type: 'MessageParameters';
    mode: bigint;
    body: Cell | null;
    value: bigint;
    to: Address;
    bounce: boolean;
}

export function storeMessageParameters(src: MessageParameters) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.mode, 257);
        if (src.body !== null && src.body !== undefined) { b_0.storeBit(true).storeRef(src.body); } else { b_0.storeBit(false); }
        b_0.storeInt(src.value, 257);
        b_0.storeAddress(src.to);
        b_0.storeBit(src.bounce);
    };
}

export function loadMessageParameters(slice: Slice) {
    const sc_0 = slice;
    const _mode = sc_0.loadIntBig(257);
    const _body = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _value = sc_0.loadIntBig(257);
    const _to = sc_0.loadAddress();
    const _bounce = sc_0.loadBit();
    return { $$type: 'MessageParameters' as const, mode: _mode, body: _body, value: _value, to: _to, bounce: _bounce };
}

export function loadTupleMessageParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _value = source.readBigNumber();
    const _to = source.readAddress();
    const _bounce = source.readBoolean();
    return { $$type: 'MessageParameters' as const, mode: _mode, body: _body, value: _value, to: _to, bounce: _bounce };
}

export function loadGetterTupleMessageParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _value = source.readBigNumber();
    const _to = source.readAddress();
    const _bounce = source.readBoolean();
    return { $$type: 'MessageParameters' as const, mode: _mode, body: _body, value: _value, to: _to, bounce: _bounce };
}

export function storeTupleMessageParameters(source: MessageParameters) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.mode);
    builder.writeCell(source.body);
    builder.writeNumber(source.value);
    builder.writeAddress(source.to);
    builder.writeBoolean(source.bounce);
    return builder.build();
}

export function dictValueParserMessageParameters(): DictionaryValue<MessageParameters> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeMessageParameters(src)).endCell());
        },
        parse: (src) => {
            return loadMessageParameters(src.loadRef().beginParse());
        }
    }
}

export type DeployParameters = {
    $$type: 'DeployParameters';
    mode: bigint;
    body: Cell | null;
    value: bigint;
    bounce: boolean;
    init: StateInit;
}

export function storeDeployParameters(src: DeployParameters) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.mode, 257);
        if (src.body !== null && src.body !== undefined) { b_0.storeBit(true).storeRef(src.body); } else { b_0.storeBit(false); }
        b_0.storeInt(src.value, 257);
        b_0.storeBit(src.bounce);
        b_0.store(storeStateInit(src.init));
    };
}

export function loadDeployParameters(slice: Slice) {
    const sc_0 = slice;
    const _mode = sc_0.loadIntBig(257);
    const _body = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _value = sc_0.loadIntBig(257);
    const _bounce = sc_0.loadBit();
    const _init = loadStateInit(sc_0);
    return { $$type: 'DeployParameters' as const, mode: _mode, body: _body, value: _value, bounce: _bounce, init: _init };
}

export function loadTupleDeployParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _value = source.readBigNumber();
    const _bounce = source.readBoolean();
    const _init = loadTupleStateInit(source);
    return { $$type: 'DeployParameters' as const, mode: _mode, body: _body, value: _value, bounce: _bounce, init: _init };
}

export function loadGetterTupleDeployParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _value = source.readBigNumber();
    const _bounce = source.readBoolean();
    const _init = loadGetterTupleStateInit(source);
    return { $$type: 'DeployParameters' as const, mode: _mode, body: _body, value: _value, bounce: _bounce, init: _init };
}

export function storeTupleDeployParameters(source: DeployParameters) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.mode);
    builder.writeCell(source.body);
    builder.writeNumber(source.value);
    builder.writeBoolean(source.bounce);
    builder.writeTuple(storeTupleStateInit(source.init));
    return builder.build();
}

export function dictValueParserDeployParameters(): DictionaryValue<DeployParameters> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeDeployParameters(src)).endCell());
        },
        parse: (src) => {
            return loadDeployParameters(src.loadRef().beginParse());
        }
    }
}

export type StdAddress = {
    $$type: 'StdAddress';
    workchain: bigint;
    address: bigint;
}

export function storeStdAddress(src: StdAddress) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.workchain, 8);
        b_0.storeUint(src.address, 256);
    };
}

export function loadStdAddress(slice: Slice) {
    const sc_0 = slice;
    const _workchain = sc_0.loadIntBig(8);
    const _address = sc_0.loadUintBig(256);
    return { $$type: 'StdAddress' as const, workchain: _workchain, address: _address };
}

export function loadTupleStdAddress(source: TupleReader) {
    const _workchain = source.readBigNumber();
    const _address = source.readBigNumber();
    return { $$type: 'StdAddress' as const, workchain: _workchain, address: _address };
}

export function loadGetterTupleStdAddress(source: TupleReader) {
    const _workchain = source.readBigNumber();
    const _address = source.readBigNumber();
    return { $$type: 'StdAddress' as const, workchain: _workchain, address: _address };
}

export function storeTupleStdAddress(source: StdAddress) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.workchain);
    builder.writeNumber(source.address);
    return builder.build();
}

export function dictValueParserStdAddress(): DictionaryValue<StdAddress> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeStdAddress(src)).endCell());
        },
        parse: (src) => {
            return loadStdAddress(src.loadRef().beginParse());
        }
    }
}

export type VarAddress = {
    $$type: 'VarAddress';
    workchain: bigint;
    address: Slice;
}

export function storeVarAddress(src: VarAddress) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.workchain, 32);
        b_0.storeRef(src.address.asCell());
    };
}

export function loadVarAddress(slice: Slice) {
    const sc_0 = slice;
    const _workchain = sc_0.loadIntBig(32);
    const _address = sc_0.loadRef().asSlice();
    return { $$type: 'VarAddress' as const, workchain: _workchain, address: _address };
}

export function loadTupleVarAddress(source: TupleReader) {
    const _workchain = source.readBigNumber();
    const _address = source.readCell().asSlice();
    return { $$type: 'VarAddress' as const, workchain: _workchain, address: _address };
}

export function loadGetterTupleVarAddress(source: TupleReader) {
    const _workchain = source.readBigNumber();
    const _address = source.readCell().asSlice();
    return { $$type: 'VarAddress' as const, workchain: _workchain, address: _address };
}

export function storeTupleVarAddress(source: VarAddress) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.workchain);
    builder.writeSlice(source.address.asCell());
    return builder.build();
}

export function dictValueParserVarAddress(): DictionaryValue<VarAddress> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeVarAddress(src)).endCell());
        },
        parse: (src) => {
            return loadVarAddress(src.loadRef().beginParse());
        }
    }
}

export type BasechainAddress = {
    $$type: 'BasechainAddress';
    hash: bigint | null;
}

export function storeBasechainAddress(src: BasechainAddress) {
    return (builder: Builder) => {
        const b_0 = builder;
        if (src.hash !== null && src.hash !== undefined) { b_0.storeBit(true).storeInt(src.hash, 257); } else { b_0.storeBit(false); }
    };
}

export function loadBasechainAddress(slice: Slice) {
    const sc_0 = slice;
    const _hash = sc_0.loadBit() ? sc_0.loadIntBig(257) : null;
    return { $$type: 'BasechainAddress' as const, hash: _hash };
}

export function loadTupleBasechainAddress(source: TupleReader) {
    const _hash = source.readBigNumberOpt();
    return { $$type: 'BasechainAddress' as const, hash: _hash };
}

export function loadGetterTupleBasechainAddress(source: TupleReader) {
    const _hash = source.readBigNumberOpt();
    return { $$type: 'BasechainAddress' as const, hash: _hash };
}

export function storeTupleBasechainAddress(source: BasechainAddress) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.hash);
    return builder.build();
}

export function dictValueParserBasechainAddress(): DictionaryValue<BasechainAddress> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBasechainAddress(src)).endCell());
        },
        parse: (src) => {
            return loadBasechainAddress(src.loadRef().beginParse());
        }
    }
}

export type Deploy = {
    $$type: 'Deploy';
    queryId: bigint;
}

export function storeDeploy(src: Deploy) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2490013878, 32);
        b_0.storeUint(src.queryId, 64);
    };
}

export function loadDeploy(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2490013878) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    return { $$type: 'Deploy' as const, queryId: _queryId };
}

export function loadTupleDeploy(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'Deploy' as const, queryId: _queryId };
}

export function loadGetterTupleDeploy(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'Deploy' as const, queryId: _queryId };
}

export function storeTupleDeploy(source: Deploy) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    return builder.build();
}

export function dictValueParserDeploy(): DictionaryValue<Deploy> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeDeploy(src)).endCell());
        },
        parse: (src) => {
            return loadDeploy(src.loadRef().beginParse());
        }
    }
}

export type DeployOk = {
    $$type: 'DeployOk';
    queryId: bigint;
}

export function storeDeployOk(src: DeployOk) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2952335191, 32);
        b_0.storeUint(src.queryId, 64);
    };
}

export function loadDeployOk(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2952335191) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    return { $$type: 'DeployOk' as const, queryId: _queryId };
}

export function loadTupleDeployOk(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'DeployOk' as const, queryId: _queryId };
}

export function loadGetterTupleDeployOk(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'DeployOk' as const, queryId: _queryId };
}

export function storeTupleDeployOk(source: DeployOk) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    return builder.build();
}

export function dictValueParserDeployOk(): DictionaryValue<DeployOk> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeDeployOk(src)).endCell());
        },
        parse: (src) => {
            return loadDeployOk(src.loadRef().beginParse());
        }
    }
}

export type FactoryDeploy = {
    $$type: 'FactoryDeploy';
    queryId: bigint;
    cashback: Address;
}

export function storeFactoryDeploy(src: FactoryDeploy) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1829761339, 32);
        b_0.storeUint(src.queryId, 64);
        b_0.storeAddress(src.cashback);
    };
}

export function loadFactoryDeploy(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1829761339) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    const _cashback = sc_0.loadAddress();
    return { $$type: 'FactoryDeploy' as const, queryId: _queryId, cashback: _cashback };
}

export function loadTupleFactoryDeploy(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _cashback = source.readAddress();
    return { $$type: 'FactoryDeploy' as const, queryId: _queryId, cashback: _cashback };
}

export function loadGetterTupleFactoryDeploy(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _cashback = source.readAddress();
    return { $$type: 'FactoryDeploy' as const, queryId: _queryId, cashback: _cashback };
}

export function storeTupleFactoryDeploy(source: FactoryDeploy) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    builder.writeAddress(source.cashback);
    return builder.build();
}

export function dictValueParserFactoryDeploy(): DictionaryValue<FactoryDeploy> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeFactoryDeploy(src)).endCell());
        },
        parse: (src) => {
            return loadFactoryDeploy(src.loadRef().beginParse());
        }
    }
}

export type ChangeOwner = {
    $$type: 'ChangeOwner';
    queryId: bigint;
    newOwner: Address;
}

export function storeChangeOwner(src: ChangeOwner) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2174598809, 32);
        b_0.storeUint(src.queryId, 64);
        b_0.storeAddress(src.newOwner);
    };
}

export function loadChangeOwner(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2174598809) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    const _newOwner = sc_0.loadAddress();
    return { $$type: 'ChangeOwner' as const, queryId: _queryId, newOwner: _newOwner };
}

export function loadTupleChangeOwner(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _newOwner = source.readAddress();
    return { $$type: 'ChangeOwner' as const, queryId: _queryId, newOwner: _newOwner };
}

export function loadGetterTupleChangeOwner(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _newOwner = source.readAddress();
    return { $$type: 'ChangeOwner' as const, queryId: _queryId, newOwner: _newOwner };
}

export function storeTupleChangeOwner(source: ChangeOwner) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    builder.writeAddress(source.newOwner);
    return builder.build();
}

export function dictValueParserChangeOwner(): DictionaryValue<ChangeOwner> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeChangeOwner(src)).endCell());
        },
        parse: (src) => {
            return loadChangeOwner(src.loadRef().beginParse());
        }
    }
}

export type ChangeOwnerOk = {
    $$type: 'ChangeOwnerOk';
    queryId: bigint;
    newOwner: Address;
}

export function storeChangeOwnerOk(src: ChangeOwnerOk) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(846932810, 32);
        b_0.storeUint(src.queryId, 64);
        b_0.storeAddress(src.newOwner);
    };
}

export function loadChangeOwnerOk(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 846932810) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    const _newOwner = sc_0.loadAddress();
    return { $$type: 'ChangeOwnerOk' as const, queryId: _queryId, newOwner: _newOwner };
}

export function loadTupleChangeOwnerOk(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _newOwner = source.readAddress();
    return { $$type: 'ChangeOwnerOk' as const, queryId: _queryId, newOwner: _newOwner };
}

export function loadGetterTupleChangeOwnerOk(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _newOwner = source.readAddress();
    return { $$type: 'ChangeOwnerOk' as const, queryId: _queryId, newOwner: _newOwner };
}

export function storeTupleChangeOwnerOk(source: ChangeOwnerOk) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    builder.writeAddress(source.newOwner);
    return builder.build();
}

export function dictValueParserChangeOwnerOk(): DictionaryValue<ChangeOwnerOk> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeChangeOwnerOk(src)).endCell());
        },
        parse: (src) => {
            return loadChangeOwnerOk(src.loadRef().beginParse());
        }
    }
}

export type CreateChallenge = {
    $$type: 'CreateChallenge';
    beneficiary: Address;
    challengeId: string;
    totalCheckpoints: bigint;
    endDate: bigint;
    unlisted: boolean;
}

export function storeCreateChallenge(src: CreateChallenge) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(3263563012, 32);
        b_0.storeAddress(src.beneficiary);
        b_0.storeStringRefTail(src.challengeId);
        b_0.storeUint(src.totalCheckpoints, 32);
        b_0.storeUint(src.endDate, 64);
        b_0.storeBit(src.unlisted);
    };
}

export function loadCreateChallenge(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 3263563012) { throw Error('Invalid prefix'); }
    const _beneficiary = sc_0.loadAddress();
    const _challengeId = sc_0.loadStringRefTail();
    const _totalCheckpoints = sc_0.loadUintBig(32);
    const _endDate = sc_0.loadUintBig(64);
    const _unlisted = sc_0.loadBit();
    return { $$type: 'CreateChallenge' as const, beneficiary: _beneficiary, challengeId: _challengeId, totalCheckpoints: _totalCheckpoints, endDate: _endDate, unlisted: _unlisted };
}

export function loadTupleCreateChallenge(source: TupleReader) {
    const _beneficiary = source.readAddress();
    const _challengeId = source.readString();
    const _totalCheckpoints = source.readBigNumber();
    const _endDate = source.readBigNumber();
    const _unlisted = source.readBoolean();
    return { $$type: 'CreateChallenge' as const, beneficiary: _beneficiary, challengeId: _challengeId, totalCheckpoints: _totalCheckpoints, endDate: _endDate, unlisted: _unlisted };
}

export function loadGetterTupleCreateChallenge(source: TupleReader) {
    const _beneficiary = source.readAddress();
    const _challengeId = source.readString();
    const _totalCheckpoints = source.readBigNumber();
    const _endDate = source.readBigNumber();
    const _unlisted = source.readBoolean();
    return { $$type: 'CreateChallenge' as const, beneficiary: _beneficiary, challengeId: _challengeId, totalCheckpoints: _totalCheckpoints, endDate: _endDate, unlisted: _unlisted };
}

export function storeTupleCreateChallenge(source: CreateChallenge) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.beneficiary);
    builder.writeString(source.challengeId);
    builder.writeNumber(source.totalCheckpoints);
    builder.writeNumber(source.endDate);
    builder.writeBoolean(source.unlisted);
    return builder.build();
}

export function dictValueParserCreateChallenge(): DictionaryValue<CreateChallenge> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCreateChallenge(src)).endCell());
        },
        parse: (src) => {
            return loadCreateChallenge(src.loadRef().beginParse());
        }
    }
}

export type AddFunds = {
    $$type: 'AddFunds';
    challengeIdx: bigint;
}

export function storeAddFunds(src: AddFunds) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1212164813, 32);
        b_0.storeUint(src.challengeIdx, 32);
    };
}

export function loadAddFunds(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1212164813) { throw Error('Invalid prefix'); }
    const _challengeIdx = sc_0.loadUintBig(32);
    return { $$type: 'AddFunds' as const, challengeIdx: _challengeIdx };
}

export function loadTupleAddFunds(source: TupleReader) {
    const _challengeIdx = source.readBigNumber();
    return { $$type: 'AddFunds' as const, challengeIdx: _challengeIdx };
}

export function loadGetterTupleAddFunds(source: TupleReader) {
    const _challengeIdx = source.readBigNumber();
    return { $$type: 'AddFunds' as const, challengeIdx: _challengeIdx };
}

export function storeTupleAddFunds(source: AddFunds) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.challengeIdx);
    return builder.build();
}

export function dictValueParserAddFunds(): DictionaryValue<AddFunds> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAddFunds(src)).endCell());
        },
        parse: (src) => {
            return loadAddFunds(src.loadRef().beginParse());
        }
    }
}

export type ClaimCheckpoint = {
    $$type: 'ClaimCheckpoint';
    challengeIdx: bigint;
    checkpointIndex: bigint;
    signature: Slice;
}

export function storeClaimCheckpoint(src: ClaimCheckpoint) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2069244991, 32);
        b_0.storeUint(src.challengeIdx, 32);
        b_0.storeUint(src.checkpointIndex, 32);
        b_0.storeRef(src.signature.asCell());
    };
}

export function loadClaimCheckpoint(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2069244991) { throw Error('Invalid prefix'); }
    const _challengeIdx = sc_0.loadUintBig(32);
    const _checkpointIndex = sc_0.loadUintBig(32);
    const _signature = sc_0.loadRef().asSlice();
    return { $$type: 'ClaimCheckpoint' as const, challengeIdx: _challengeIdx, checkpointIndex: _checkpointIndex, signature: _signature };
}

export function loadTupleClaimCheckpoint(source: TupleReader) {
    const _challengeIdx = source.readBigNumber();
    const _checkpointIndex = source.readBigNumber();
    const _signature = source.readCell().asSlice();
    return { $$type: 'ClaimCheckpoint' as const, challengeIdx: _challengeIdx, checkpointIndex: _checkpointIndex, signature: _signature };
}

export function loadGetterTupleClaimCheckpoint(source: TupleReader) {
    const _challengeIdx = source.readBigNumber();
    const _checkpointIndex = source.readBigNumber();
    const _signature = source.readCell().asSlice();
    return { $$type: 'ClaimCheckpoint' as const, challengeIdx: _challengeIdx, checkpointIndex: _checkpointIndex, signature: _signature };
}

export function storeTupleClaimCheckpoint(source: ClaimCheckpoint) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.challengeIdx);
    builder.writeNumber(source.checkpointIndex);
    builder.writeSlice(source.signature.asCell());
    return builder.build();
}

export function dictValueParserClaimCheckpoint(): DictionaryValue<ClaimCheckpoint> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeClaimCheckpoint(src)).endCell());
        },
        parse: (src) => {
            return loadClaimCheckpoint(src.loadRef().beginParse());
        }
    }
}

export type RefundUnclaimed = {
    $$type: 'RefundUnclaimed';
    challengeIdx: bigint;
}

export function storeRefundUnclaimed(src: RefundUnclaimed) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1892462292, 32);
        b_0.storeUint(src.challengeIdx, 32);
    };
}

export function loadRefundUnclaimed(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1892462292) { throw Error('Invalid prefix'); }
    const _challengeIdx = sc_0.loadUintBig(32);
    return { $$type: 'RefundUnclaimed' as const, challengeIdx: _challengeIdx };
}

export function loadTupleRefundUnclaimed(source: TupleReader) {
    const _challengeIdx = source.readBigNumber();
    return { $$type: 'RefundUnclaimed' as const, challengeIdx: _challengeIdx };
}

export function loadGetterTupleRefundUnclaimed(source: TupleReader) {
    const _challengeIdx = source.readBigNumber();
    return { $$type: 'RefundUnclaimed' as const, challengeIdx: _challengeIdx };
}

export function storeTupleRefundUnclaimed(source: RefundUnclaimed) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.challengeIdx);
    return builder.build();
}

export function dictValueParserRefundUnclaimed(): DictionaryValue<RefundUnclaimed> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeRefundUnclaimed(src)).endCell());
        },
        parse: (src) => {
            return loadRefundUnclaimed(src.loadRef().beginParse());
        }
    }
}

export type ChallengeData = {
    $$type: 'ChallengeData';
    sponsor: Address;
    beneficiary: Address;
    challengeId: string;
    totalDeposit: bigint;
    totalCheckpoints: bigint;
    amountPerCheckpoint: bigint;
    claimedCount: bigint;
    endDate: bigint;
    createdAt: bigint;
    active: boolean;
    unlisted: boolean;
}

export function storeChallengeData(src: ChallengeData) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.sponsor);
        b_0.storeAddress(src.beneficiary);
        b_0.storeStringRefTail(src.challengeId);
        b_0.storeCoins(src.totalDeposit);
        b_0.storeUint(src.totalCheckpoints, 32);
        b_0.storeCoins(src.amountPerCheckpoint);
        b_0.storeUint(src.claimedCount, 32);
        b_0.storeUint(src.endDate, 64);
        b_0.storeUint(src.createdAt, 64);
        b_0.storeBit(src.active);
        b_0.storeBit(src.unlisted);
    };
}

export function loadChallengeData(slice: Slice) {
    const sc_0 = slice;
    const _sponsor = sc_0.loadAddress();
    const _beneficiary = sc_0.loadAddress();
    const _challengeId = sc_0.loadStringRefTail();
    const _totalDeposit = sc_0.loadCoins();
    const _totalCheckpoints = sc_0.loadUintBig(32);
    const _amountPerCheckpoint = sc_0.loadCoins();
    const _claimedCount = sc_0.loadUintBig(32);
    const _endDate = sc_0.loadUintBig(64);
    const _createdAt = sc_0.loadUintBig(64);
    const _active = sc_0.loadBit();
    const _unlisted = sc_0.loadBit();
    return { $$type: 'ChallengeData' as const, sponsor: _sponsor, beneficiary: _beneficiary, challengeId: _challengeId, totalDeposit: _totalDeposit, totalCheckpoints: _totalCheckpoints, amountPerCheckpoint: _amountPerCheckpoint, claimedCount: _claimedCount, endDate: _endDate, createdAt: _createdAt, active: _active, unlisted: _unlisted };
}

export function loadTupleChallengeData(source: TupleReader) {
    const _sponsor = source.readAddress();
    const _beneficiary = source.readAddress();
    const _challengeId = source.readString();
    const _totalDeposit = source.readBigNumber();
    const _totalCheckpoints = source.readBigNumber();
    const _amountPerCheckpoint = source.readBigNumber();
    const _claimedCount = source.readBigNumber();
    const _endDate = source.readBigNumber();
    const _createdAt = source.readBigNumber();
    const _active = source.readBoolean();
    const _unlisted = source.readBoolean();
    return { $$type: 'ChallengeData' as const, sponsor: _sponsor, beneficiary: _beneficiary, challengeId: _challengeId, totalDeposit: _totalDeposit, totalCheckpoints: _totalCheckpoints, amountPerCheckpoint: _amountPerCheckpoint, claimedCount: _claimedCount, endDate: _endDate, createdAt: _createdAt, active: _active, unlisted: _unlisted };
}

export function loadGetterTupleChallengeData(source: TupleReader) {
    const _sponsor = source.readAddress();
    const _beneficiary = source.readAddress();
    const _challengeId = source.readString();
    const _totalDeposit = source.readBigNumber();
    const _totalCheckpoints = source.readBigNumber();
    const _amountPerCheckpoint = source.readBigNumber();
    const _claimedCount = source.readBigNumber();
    const _endDate = source.readBigNumber();
    const _createdAt = source.readBigNumber();
    const _active = source.readBoolean();
    const _unlisted = source.readBoolean();
    return { $$type: 'ChallengeData' as const, sponsor: _sponsor, beneficiary: _beneficiary, challengeId: _challengeId, totalDeposit: _totalDeposit, totalCheckpoints: _totalCheckpoints, amountPerCheckpoint: _amountPerCheckpoint, claimedCount: _claimedCount, endDate: _endDate, createdAt: _createdAt, active: _active, unlisted: _unlisted };
}

export function storeTupleChallengeData(source: ChallengeData) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.sponsor);
    builder.writeAddress(source.beneficiary);
    builder.writeString(source.challengeId);
    builder.writeNumber(source.totalDeposit);
    builder.writeNumber(source.totalCheckpoints);
    builder.writeNumber(source.amountPerCheckpoint);
    builder.writeNumber(source.claimedCount);
    builder.writeNumber(source.endDate);
    builder.writeNumber(source.createdAt);
    builder.writeBoolean(source.active);
    builder.writeBoolean(source.unlisted);
    return builder.build();
}

export function dictValueParserChallengeData(): DictionaryValue<ChallengeData> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeChallengeData(src)).endCell());
        },
        parse: (src) => {
            return loadChallengeData(src.loadRef().beginParse());
        }
    }
}

export type ProductivityEscrow$Data = {
    $$type: 'ProductivityEscrow$Data';
    owner: Address;
    verifierPublicKey: bigint;
    challengeCount: bigint;
    challenges: Dictionary<bigint, ChallengeData>;
    claimedCheckpoints: Dictionary<bigint, boolean>;
    sponsorContributions: Dictionary<bigint, bigint>;
    feeWalletA: Address;
    feeWalletB: Address;
}

export function storeProductivityEscrow$Data(src: ProductivityEscrow$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.owner);
        b_0.storeUint(src.verifierPublicKey, 256);
        b_0.storeUint(src.challengeCount, 32);
        b_0.storeDict(src.challenges, Dictionary.Keys.BigInt(257), dictValueParserChallengeData());
        b_0.storeDict(src.claimedCheckpoints, Dictionary.Keys.BigInt(257), Dictionary.Values.Bool());
        const b_1 = new Builder();
        b_1.storeDict(src.sponsorContributions, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257));
        b_1.storeAddress(src.feeWalletA);
        b_1.storeAddress(src.feeWalletB);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadProductivityEscrow$Data(slice: Slice) {
    const sc_0 = slice;
    const _owner = sc_0.loadAddress();
    const _verifierPublicKey = sc_0.loadUintBig(256);
    const _challengeCount = sc_0.loadUintBig(32);
    const _challenges = Dictionary.load(Dictionary.Keys.BigInt(257), dictValueParserChallengeData(), sc_0);
    const _claimedCheckpoints = Dictionary.load(Dictionary.Keys.BigInt(257), Dictionary.Values.Bool(), sc_0);
    const sc_1 = sc_0.loadRef().beginParse();
    const _sponsorContributions = Dictionary.load(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), sc_1);
    const _feeWalletA = sc_1.loadAddress();
    const _feeWalletB = sc_1.loadAddress();
    return { $$type: 'ProductivityEscrow$Data' as const, owner: _owner, verifierPublicKey: _verifierPublicKey, challengeCount: _challengeCount, challenges: _challenges, claimedCheckpoints: _claimedCheckpoints, sponsorContributions: _sponsorContributions, feeWalletA: _feeWalletA, feeWalletB: _feeWalletB };
}

export function loadTupleProductivityEscrow$Data(source: TupleReader) {
    const _owner = source.readAddress();
    const _verifierPublicKey = source.readBigNumber();
    const _challengeCount = source.readBigNumber();
    const _challenges = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserChallengeData(), source.readCellOpt());
    const _claimedCheckpoints = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.Bool(), source.readCellOpt());
    const _sponsorContributions = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _feeWalletA = source.readAddress();
    const _feeWalletB = source.readAddress();
    return { $$type: 'ProductivityEscrow$Data' as const, owner: _owner, verifierPublicKey: _verifierPublicKey, challengeCount: _challengeCount, challenges: _challenges, claimedCheckpoints: _claimedCheckpoints, sponsorContributions: _sponsorContributions, feeWalletA: _feeWalletA, feeWalletB: _feeWalletB };
}

export function loadGetterTupleProductivityEscrow$Data(source: TupleReader) {
    const _owner = source.readAddress();
    const _verifierPublicKey = source.readBigNumber();
    const _challengeCount = source.readBigNumber();
    const _challenges = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), dictValueParserChallengeData(), source.readCellOpt());
    const _claimedCheckpoints = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.Bool(), source.readCellOpt());
    const _sponsorContributions = Dictionary.loadDirect(Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257), source.readCellOpt());
    const _feeWalletA = source.readAddress();
    const _feeWalletB = source.readAddress();
    return { $$type: 'ProductivityEscrow$Data' as const, owner: _owner, verifierPublicKey: _verifierPublicKey, challengeCount: _challengeCount, challenges: _challenges, claimedCheckpoints: _claimedCheckpoints, sponsorContributions: _sponsorContributions, feeWalletA: _feeWalletA, feeWalletB: _feeWalletB };
}

export function storeTupleProductivityEscrow$Data(source: ProductivityEscrow$Data) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.owner);
    builder.writeNumber(source.verifierPublicKey);
    builder.writeNumber(source.challengeCount);
    builder.writeCell(source.challenges.size > 0 ? beginCell().storeDictDirect(source.challenges, Dictionary.Keys.BigInt(257), dictValueParserChallengeData()).endCell() : null);
    builder.writeCell(source.claimedCheckpoints.size > 0 ? beginCell().storeDictDirect(source.claimedCheckpoints, Dictionary.Keys.BigInt(257), Dictionary.Values.Bool()).endCell() : null);
    builder.writeCell(source.sponsorContributions.size > 0 ? beginCell().storeDictDirect(source.sponsorContributions, Dictionary.Keys.BigInt(257), Dictionary.Values.BigInt(257)).endCell() : null);
    builder.writeAddress(source.feeWalletA);
    builder.writeAddress(source.feeWalletB);
    return builder.build();
}

export function dictValueParserProductivityEscrow$Data(): DictionaryValue<ProductivityEscrow$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeProductivityEscrow$Data(src)).endCell());
        },
        parse: (src) => {
            return loadProductivityEscrow$Data(src.loadRef().beginParse());
        }
    }
}

 type ProductivityEscrow_init_args = {
    $$type: 'ProductivityEscrow_init_args';
    owner: Address;
    verifierPublicKey: bigint;
    feeWalletA: Address;
    feeWalletB: Address;
}

function initProductivityEscrow_init_args(src: ProductivityEscrow_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.owner);
        b_0.storeInt(src.verifierPublicKey, 257);
        b_0.storeAddress(src.feeWalletA);
        const b_1 = new Builder();
        b_1.storeAddress(src.feeWalletB);
        b_0.storeRef(b_1.endCell());
    };
}

async function ProductivityEscrow_init(owner: Address, verifierPublicKey: bigint, feeWalletA: Address, feeWalletB: Address) {
    const __code = Cell.fromHex('b5ee9c72410226010008e0000228ff008e88f4a413f4bcf2c80bed5320e303ed43d90112020271020d02012003050199bbbe4ed44d0d200018e1efa40d3ffd31ff404d401d0f404f404fa40fa403010481047104610456c188e1dfa40810101d700fa40d401d0fa403014433004d1550270026d6d5a6d02e2db3c6c81804000225020120060b020162070901c8a837ed44d0d200018e1efa40d3ffd31ff404d401d0f404f404fa40fa403010481047104610456c188e1dfa40810101d700fa40d401d0fa403014433004d1550270026d6d5a6d02e25507db3c6c81206e92306d99206ef2d0806f2b6f0be2206e92306dde08013a810101260259f40d6fa192306ddf206e92306d8e87d0db3c6c1b6f0be21d0198a91ded44d0d200018e1efa40d3ffd31ff404d401d0f404f404fa40fa403010481047104610456c188e1dfa40810101d700fa40d401d0fa403014433004d1550270026d6d5a6d02e2db3c6c810a000227019db7205da89a1a400031c3df481a7ffa63fe809a803a1e809e809f481f480602090208e208c208ad8311c3bf481020203ae01f481a803a1f4806028866009a2aa04e004dadab4da05c4aa2fb678d90300c0040c812cb1fcb1fc9f9008101012502714133f40c6fa19401d70030925b6de26eb30201200e100199b8bf5ed44d0d200018e1efa40d3ffd31ff404d401d0f404f404fa40fa403010481047104610456c188e1dfa40810101d700fa40d401d0fa403014433004d1550270026d6d5a6d02e2db3c6c8180f000226019db8790ed44d0d200018e1efa40d3ffd31ff404d401d0f404f404fa40fa403010481047104610456c188e1dfa40810101d700fa40d401d0fa403014433004d1550270026d6d5a6d02e25517db3c6c818110058c812cb1f01cf16c9f900810101530450334133f40c6fa19401d70030925b6de2206eb395206ef2d080e0307002f83001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e1efa40d3ffd31ff404d401d0f404f404fa40fa403010481047104610456c188e1dfa40810101d700fa40d401d0fa403014433004d1550270026d6d5a6d02e209925f09e007d70d1ff2e082218210c2860504bae30221821048402acdba131502fc31fa40d401d001d31fd33fd20030f8416f243032816cf022820afaf080bcf2f4816f8225c200f2f4f8235240bcf2e65301820afaf080a15304a9048108cd21c200f2f481010170f8237f265196109d108c106b105b433dc855a0db3cc927103701206e953059f45a30944133f415e2c85260cb1f5005cf16c9f9008101011e14007c5122216e955b59f45a3098c801cf004133f442e203a410571046443512c87f01ca0055705078ce15cbff13cb1ff40001c8f40012f40012ce12cecdc9ed5404fe8ffb31d31f30f8416f243032258101012459f40d6fa192306ddf206e92306d8e87d0db3c6c1b6f0be281209a216eb3f2f4206ef2d0806f2b358120f121f2f48200efb8f82324bbf2f48200f4d22c8208989680bcf2f40b8208989680a15166a05305a904109a108a107a553006050c8101010dc855a0db3cc947305240e0211d1e161700fa206e953059f45a30944133f415e2c813cb1f5005cf16c9f90081010154530052304133f40c6fa19401d70030925b6de270216eb39630206ef2d0809131e281010106a0251036216e955b59f45a3098c801cf004133f442e210575514c87f01ca0055705078ce15cbff13cb1ff40001c8f40012f40012ce12cecdc9ed5403fe82107b562c3fba8f7631d31fd31fd430d0f8416f2410235f03268101012559f40d6fa192306ddf206e92306d8e87d0db3c6c1b6f0be281209a216eb3f2f4206ef2d0806f2b8120f158f2f48200d92d51b9c7051bf2f4812fbef82323bcf2f48200a85353c5b9f2f4c852d0cb1f52c0cb1fc9f9008200e1e5561081010123711d181c04fc4133f40c6fa19401d70030925b6de26ef2f4c852e0cb1f1dcb1f28cf16c9f9008200bd110c5613f9101bf2f41d810101500b7f71216e955b59f45a3098c801cf004133f442e20ca45302b98101015373103d4cdbc855a0db3cc9103714206e953059f45a30944133f415e27188103610265a6d6d40037fc8cf8580ca00891e191a1b002a00000000436865636b706f696e7420726577617264000110009ccf16ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0010575514c87f01ca0055705078ce15cbff13cb1ff40001c8f40012f40012ce12cecdc9ed5404fee021821070ccaed4ba8ff431d31f30f8416f2410235f03248101012359f40d6fa192306ddf206e92306d8e87d0db3c6c1b6f0be281209a216eb3f2f4206ef2d0806f2b81452551cbc7051cf2f4812fbef82324bcf2f48200f35301f2f45342a124a8810101702b519b09108b5076105b03504e4bb0c855a0db3cc910385e311d1e1f250034fa40fa40d401d001fa00d31ffa00d31fd33fd33fd200d20055a0003c50abce18ce06c8ce16cd5004fa0212cb1f01fa02cb1fcb3fcb3fca00ca0003be206e953059f45a30944133f415e222c2008f445252c7058ebc7188103610265a6d6d40037fc8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00e30d92355be210575514202124002800000000556e636c61696d656420726566756e6402aa3420a7148064a90466a121c2008ebc71882a0344445a6d6d40037fc8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb009131e220c2009130e30d2322017671882a55205a6d6d40037fc8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0023003400000000506572736f6e616c206368616c6c656e6765206665650042c87f01ca0055705078ce15cbff13cb1ff40001c8f40012f40012ce12cecdc9ed5400e2e0018210946a98b6ba8e60d33f30c8018210aff90f5758cb1fcb3fc91068105710461035443012f84270705003804201503304c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00c87f01ca0055705078ce15cbff13cb1ff40001c8f40012f40012ce12cecdc9ed54e05f09f2c0821614ec29');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initProductivityEscrow_init_args({ $$type: 'ProductivityEscrow_init_args', owner, verifierPublicKey, feeWalletA, feeWalletB })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const ProductivityEscrow_errors = {
    2: { message: "Stack underflow" },
    3: { message: "Stack overflow" },
    4: { message: "Integer overflow" },
    5: { message: "Integer out of expected range" },
    6: { message: "Invalid opcode" },
    7: { message: "Type check error" },
    8: { message: "Cell overflow" },
    9: { message: "Cell underflow" },
    10: { message: "Dictionary error" },
    11: { message: "'Unknown' error" },
    12: { message: "Fatal error" },
    13: { message: "Out of gas error" },
    14: { message: "Virtualization error" },
    32: { message: "Action list is invalid" },
    33: { message: "Action list is too long" },
    34: { message: "Action is invalid or not supported" },
    35: { message: "Invalid source address in outbound message" },
    36: { message: "Invalid destination address in outbound message" },
    37: { message: "Not enough Toncoin" },
    38: { message: "Not enough extra currencies" },
    39: { message: "Outbound message does not fit into a cell after rewriting" },
    40: { message: "Cannot process a message" },
    41: { message: "Library reference is null" },
    42: { message: "Library change action error" },
    43: { message: "Exceeded maximum number of cells in the library or the maximum depth of the Merkle tree" },
    50: { message: "Account state size exceeded limits" },
    128: { message: "Null reference exception" },
    129: { message: "Invalid serialization prefix" },
    130: { message: "Invalid incoming message" },
    131: { message: "Constraints error" },
    132: { message: "Access denied" },
    133: { message: "Contract stopped" },
    134: { message: "Invalid argument" },
    135: { message: "Code of a contract was not found" },
    136: { message: "Invalid standard address" },
    138: { message: "Not a basechain address" },
    1619: { message: "End date must be in the future" },
    2253: { message: "Deposit too small for checkpoint count" },
    8346: { message: "Challenge not found" },
    8433: { message: "Challenge is not active" },
    12222: { message: "Challenge has not ended yet" },
    17701: { message: "Only sponsor can refund" },
    27888: { message: "Insufficient deposit. Must send TON to fund the challenge." },
    28546: { message: "Must have at least 1 checkpoint" },
    43091: { message: "Invalid checkpoint index" },
    48401: { message: "Invalid signature" },
    55597: { message: "Only beneficiary can claim" },
    57829: { message: "Checkpoint already claimed" },
    61368: { message: "Challenge has expired" },
    62291: { message: "Challenge already closed" },
    62674: { message: "Must send more than 0.01 TON" },
} as const

export const ProductivityEscrow_errors_backward = {
    "Stack underflow": 2,
    "Stack overflow": 3,
    "Integer overflow": 4,
    "Integer out of expected range": 5,
    "Invalid opcode": 6,
    "Type check error": 7,
    "Cell overflow": 8,
    "Cell underflow": 9,
    "Dictionary error": 10,
    "'Unknown' error": 11,
    "Fatal error": 12,
    "Out of gas error": 13,
    "Virtualization error": 14,
    "Action list is invalid": 32,
    "Action list is too long": 33,
    "Action is invalid or not supported": 34,
    "Invalid source address in outbound message": 35,
    "Invalid destination address in outbound message": 36,
    "Not enough Toncoin": 37,
    "Not enough extra currencies": 38,
    "Outbound message does not fit into a cell after rewriting": 39,
    "Cannot process a message": 40,
    "Library reference is null": 41,
    "Library change action error": 42,
    "Exceeded maximum number of cells in the library or the maximum depth of the Merkle tree": 43,
    "Account state size exceeded limits": 50,
    "Null reference exception": 128,
    "Invalid serialization prefix": 129,
    "Invalid incoming message": 130,
    "Constraints error": 131,
    "Access denied": 132,
    "Contract stopped": 133,
    "Invalid argument": 134,
    "Code of a contract was not found": 135,
    "Invalid standard address": 136,
    "Not a basechain address": 138,
    "End date must be in the future": 1619,
    "Deposit too small for checkpoint count": 2253,
    "Challenge not found": 8346,
    "Challenge is not active": 8433,
    "Challenge has not ended yet": 12222,
    "Only sponsor can refund": 17701,
    "Insufficient deposit. Must send TON to fund the challenge.": 27888,
    "Must have at least 1 checkpoint": 28546,
    "Invalid checkpoint index": 43091,
    "Invalid signature": 48401,
    "Only beneficiary can claim": 55597,
    "Checkpoint already claimed": 57829,
    "Challenge has expired": 61368,
    "Challenge already closed": 62291,
    "Must send more than 0.01 TON": 62674,
} as const

const ProductivityEscrow_types: ABIType[] = [
    {"name":"DataSize","header":null,"fields":[{"name":"cells","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"bits","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"refs","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"SignedBundle","header":null,"fields":[{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signedData","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"StateInit","header":null,"fields":[{"name":"code","type":{"kind":"simple","type":"cell","optional":false}},{"name":"data","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"Context","header":null,"fields":[{"name":"bounceable","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sender","type":{"kind":"simple","type":"address","optional":false}},{"name":"value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"raw","type":{"kind":"simple","type":"slice","optional":false}}]},
    {"name":"SendParameters","header":null,"fields":[{"name":"mode","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body","type":{"kind":"simple","type":"cell","optional":true}},{"name":"code","type":{"kind":"simple","type":"cell","optional":true}},{"name":"data","type":{"kind":"simple","type":"cell","optional":true}},{"name":"value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"to","type":{"kind":"simple","type":"address","optional":false}},{"name":"bounce","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"MessageParameters","header":null,"fields":[{"name":"mode","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body","type":{"kind":"simple","type":"cell","optional":true}},{"name":"value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"to","type":{"kind":"simple","type":"address","optional":false}},{"name":"bounce","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"DeployParameters","header":null,"fields":[{"name":"mode","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body","type":{"kind":"simple","type":"cell","optional":true}},{"name":"value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"bounce","type":{"kind":"simple","type":"bool","optional":false}},{"name":"init","type":{"kind":"simple","type":"StateInit","optional":false}}]},
    {"name":"StdAddress","header":null,"fields":[{"name":"workchain","type":{"kind":"simple","type":"int","optional":false,"format":8}},{"name":"address","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"VarAddress","header":null,"fields":[{"name":"workchain","type":{"kind":"simple","type":"int","optional":false,"format":32}},{"name":"address","type":{"kind":"simple","type":"slice","optional":false}}]},
    {"name":"BasechainAddress","header":null,"fields":[{"name":"hash","type":{"kind":"simple","type":"int","optional":true,"format":257}}]},
    {"name":"Deploy","header":2490013878,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"DeployOk","header":2952335191,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"FactoryDeploy","header":1829761339,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"cashback","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"ChangeOwner","header":2174598809,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"newOwner","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"ChangeOwnerOk","header":846932810,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"newOwner","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"CreateChallenge","header":3263563012,"fields":[{"name":"beneficiary","type":{"kind":"simple","type":"address","optional":false}},{"name":"challengeId","type":{"kind":"simple","type":"string","optional":false}},{"name":"totalCheckpoints","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"endDate","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"unlisted","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"AddFunds","header":1212164813,"fields":[{"name":"challengeIdx","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"ClaimCheckpoint","header":2069244991,"fields":[{"name":"challengeIdx","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"checkpointIndex","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"signature","type":{"kind":"simple","type":"slice","optional":false}}]},
    {"name":"RefundUnclaimed","header":1892462292,"fields":[{"name":"challengeIdx","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"ChallengeData","header":null,"fields":[{"name":"sponsor","type":{"kind":"simple","type":"address","optional":false}},{"name":"beneficiary","type":{"kind":"simple","type":"address","optional":false}},{"name":"challengeId","type":{"kind":"simple","type":"string","optional":false}},{"name":"totalDeposit","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"totalCheckpoints","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"amountPerCheckpoint","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"claimedCount","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"endDate","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"createdAt","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"active","type":{"kind":"simple","type":"bool","optional":false}},{"name":"unlisted","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"ProductivityEscrow$Data","header":null,"fields":[{"name":"owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"verifierPublicKey","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"challengeCount","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"challenges","type":{"kind":"dict","key":"int","value":"ChallengeData","valueFormat":"ref"}},{"name":"claimedCheckpoints","type":{"kind":"dict","key":"int","value":"bool"}},{"name":"sponsorContributions","type":{"kind":"dict","key":"int","value":"int"}},{"name":"feeWalletA","type":{"kind":"simple","type":"address","optional":false}},{"name":"feeWalletB","type":{"kind":"simple","type":"address","optional":false}}]},
]

const ProductivityEscrow_opcodes = {
    "Deploy": 2490013878,
    "DeployOk": 2952335191,
    "FactoryDeploy": 1829761339,
    "ChangeOwner": 2174598809,
    "ChangeOwnerOk": 846932810,
    "CreateChallenge": 3263563012,
    "AddFunds": 1212164813,
    "ClaimCheckpoint": 2069244991,
    "RefundUnclaimed": 1892462292,
}

const ProductivityEscrow_getters: ABIGetter[] = [
    {"name":"challengeCount","methodId":80868,"arguments":[],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"challenge","methodId":81975,"arguments":[{"name":"idx","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"ChallengeData","optional":true}},
    {"name":"isCheckpointClaimed","methodId":96514,"arguments":[{"name":"challengeIdx","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"checkpointIdx","type":{"kind":"simple","type":"int","optional":false,"format":257}}],"returnType":{"kind":"simple","type":"bool","optional":false}},
    {"name":"sponsorContribution","methodId":116624,"arguments":[{"name":"challengeIdx","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"sponsor","type":{"kind":"simple","type":"address","optional":false}}],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"verifierPublicKey","methodId":101365,"arguments":[],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"owner","methodId":83229,"arguments":[],"returnType":{"kind":"simple","type":"address","optional":false}},
]

export const ProductivityEscrow_getterMapping: { [key: string]: string } = {
    'challengeCount': 'getChallengeCount',
    'challenge': 'getChallenge',
    'isCheckpointClaimed': 'getIsCheckpointClaimed',
    'sponsorContribution': 'getSponsorContribution',
    'verifierPublicKey': 'getVerifierPublicKey',
    'owner': 'getOwner',
}

const ProductivityEscrow_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"CreateChallenge"}},
    {"receiver":"internal","message":{"kind":"typed","type":"AddFunds"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ClaimCheckpoint"}},
    {"receiver":"internal","message":{"kind":"typed","type":"RefundUnclaimed"}},
    {"receiver":"internal","message":{"kind":"typed","type":"Deploy"}},
]


export class ProductivityEscrow implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = ProductivityEscrow_errors_backward;
    public static readonly opcodes = ProductivityEscrow_opcodes;
    
    static async init(owner: Address, verifierPublicKey: bigint, feeWalletA: Address, feeWalletB: Address) {
        return await ProductivityEscrow_init(owner, verifierPublicKey, feeWalletA, feeWalletB);
    }
    
    static async fromInit(owner: Address, verifierPublicKey: bigint, feeWalletA: Address, feeWalletB: Address) {
        const __gen_init = await ProductivityEscrow_init(owner, verifierPublicKey, feeWalletA, feeWalletB);
        const address = contractAddress(0, __gen_init);
        return new ProductivityEscrow(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new ProductivityEscrow(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  ProductivityEscrow_types,
        getters: ProductivityEscrow_getters,
        receivers: ProductivityEscrow_receivers,
        errors: ProductivityEscrow_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: CreateChallenge | AddFunds | ClaimCheckpoint | RefundUnclaimed | Deploy) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'CreateChallenge') {
            body = beginCell().store(storeCreateChallenge(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'AddFunds') {
            body = beginCell().store(storeAddFunds(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ClaimCheckpoint') {
            body = beginCell().store(storeClaimCheckpoint(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'RefundUnclaimed') {
            body = beginCell().store(storeRefundUnclaimed(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'Deploy') {
            body = beginCell().store(storeDeploy(message)).endCell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.internal(via, { ...args, body: body });
        
    }
    
    async getChallengeCount(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('challengeCount', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
    async getChallenge(provider: ContractProvider, idx: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(idx);
        const source = (await provider.get('challenge', builder.build())).stack;
        const result_p = source.readTupleOpt();
        const result = result_p ? loadTupleChallengeData(result_p) : null;
        return result;
    }
    
    async getIsCheckpointClaimed(provider: ContractProvider, challengeIdx: bigint, checkpointIdx: bigint) {
        const builder = new TupleBuilder();
        builder.writeNumber(challengeIdx);
        builder.writeNumber(checkpointIdx);
        const source = (await provider.get('isCheckpointClaimed', builder.build())).stack;
        const result = source.readBoolean();
        return result;
    }
    
    async getSponsorContribution(provider: ContractProvider, challengeIdx: bigint, sponsor: Address) {
        const builder = new TupleBuilder();
        builder.writeNumber(challengeIdx);
        builder.writeAddress(sponsor);
        const source = (await provider.get('sponsorContribution', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
    async getVerifierPublicKey(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('verifierPublicKey', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
    async getOwner(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('owner', builder.build())).stack;
        const result = source.readAddress();
        return result;
    }
    
}