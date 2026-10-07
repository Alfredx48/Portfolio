// An in-memory stand-in for PeerJS's Peer and DataConnection, for the component tests.
// Delivery is synchronous, and opening takes a microtask like the real thing takes a network round trip.
// It copies the real library's awkward bits on purpose: destroy() emits 'disconnected' before `destroyed` is set,
// reconnect() brings a peer back (even a destroyed one, if it was called mid-destroy), and a lost broker
// emits error{network} and then 'disconnected'.

class Emitter {
	handlers = {};
	on(event, handler) {
		(this.handlers[event] ??= []).push(handler);
		return this;
	}
	emit(event, ...args) {
		for (const handler of this.handlers[event] ?? []) handler(...args);
	}
}

export const network = {
	peers: new Map(), // id -> peer, for peers the broker currently knows
	sockets: new Set(), // peers with an open socket to the broker. Anything left after a page is gone is a leak.
	pairs: [], // { guest, host } connection ends, in the order they were made
	sent: [], // everything each end sent: { from, data } with data parsed, and `raw` as it went over the wire
	unavailableIds: 0, // the next n `new Peer(id)` calls report an id clash
	hang: false, // connect() never opens
	hangOpen: false, // new Peer() never reaches the broker
	brokerDown: false, // reconnect() fails
	missNext: false, // the next connect() finds nobody there
	reset() {
		this.peers.clear();
		this.sockets.clear();
		this.pairs = [];
		this.sent = [];
		this.unavailableIds = 0;
		this.hang = this.hangOpen = this.brokerDown = this.missNext = false;
	},
	// The broker connection of `peer` dies, the way PeerJS reports it
	dropBroker(peer) {
		peer.emit('error', { type: 'network' });
		peer.disconnect();
	},
};

let anonymous = 0;

class FakeConnection extends Emitter {
	open = false;
	remote = null;
	muted = false;
	constructor(label, serialization) {
		super();
		this.label = label;
		this.serialization = serialization;
	}
	send(data) {
		if (!this.open) throw new Error('connection is not open');
		network.sent.push({ from: this.label, data: typeof data === 'string' ? JSON.parse(data) : data, raw: data });
		// A crashed tab or a sleeping phone: nothing arrives, and nothing says so
		if (this.muted || this.remote.muted) return;
		this.remote.emit('data', data);
	}
	close() {
		if (this.closed) return;
		this.closed = true;
		this.open = false;
		this.emit('close');
		this.remote?.close();
	}
}

export class FakePeer extends Emitter {
	connections = [];
	disconnected = false;
	destroyed = false;
	constructor(id) {
		super();
		this.id = id ?? `anonymous-${++anonymous}`;
		this.requestedId = id;
		network.sockets.add(this);
		queueMicrotask(() => {
			if (this.destroyed || network.hangOpen) return;
			if (id && (network.unavailableIds > 0 || network.peers.has(id))) {
				network.unavailableIds = Math.max(0, network.unavailableIds - 1);
				this.emit('error', { type: 'unavailable-id' });
				return;
			}
			network.peers.set(this.id, this);
			this.emit('open', this.id);
		});
	}
	connect(id, options = {}) {
		const guest = new FakeConnection('guest', options.serialization ?? 'binary');
		this.connections.push(guest);
		queueMicrotask(() => {
			if (this.destroyed || network.hang) return;
			const target = network.missNext ? null : network.peers.get(id);
			network.missNext = false;
			if (!target) return this.emit('error', { type: 'peer-unavailable' });
			const host = new FakeConnection('host', guest.serialization);
			[guest.remote, host.remote] = [host, guest];
			target.connections.push(host);
			network.pairs.push({ guest, host });
			target.emit('connection', host);
			if (host.closed) return; // turned away before it opened
			guest.open = host.open = true;
			host.emit('open');
			guest.emit('open');
		});
		return guest;
	}
	// Closes the broker socket. Connections between peers carry on.
	disconnect() {
		if (this.disconnected) return;
		this.disconnected = true;
		network.sockets.delete(this);
		if (network.peers.get(this.id) === this) network.peers.delete(this.id);
		this.emit('disconnected', this.id);
	}
	reconnect() {
		if (this.destroyed) throw new Error('This peer cannot reconnect to the server. It has already been destroyed.');
		if (!this.disconnected) return;
		this.disconnected = false;
		network.sockets.add(this);
		queueMicrotask(() => {
			// Deliberately no `destroyed` check: a socket opened mid-destroy is exactly the leak to catch
			if (network.brokerDown) {
				this.emit('error', { type: 'network' });
				this.disconnect();
				return;
			}
			network.peers.set(this.id, this);
			this.emit('open', this.id);
		});
	}
	destroy() {
		if (this.destroyed) return;
		this.disconnect();
		this.destroyed = true;
		for (const connection of this.connections) connection.close();
	}
}
