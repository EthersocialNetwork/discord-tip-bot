function evenOdd() {
	let side = { "0": "even", "1": "odd" };
	let rnd = Math.round(Math.random() * 1000) % 2;
	return side[rnd];
}

function redBlack() {
	let side = { "0": "red", "1": "black" };
	let rnd = Math.round(Math.random() * 1000) % 2;
	return side[rnd];
}

function dice() {
	let rnd = Math.round(Math.random() * 1000) % 6;
	return rnd + 1;
}

module.exports = {
	evenOdd,
	redBlack,
	dice,
};
