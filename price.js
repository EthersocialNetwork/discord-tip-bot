"use strict";
var request = require("request");
var fs = require("fs");

const MARKETCAP = 'https://api.coinmarketcap.com/v1/ticker/';

var data = {};

function getCMCPrice(ticker) {
	request(MARKETCAP + ticker, (error, response, body)=>{
		try{
			var dataCoin = JSON.parse(body);
		} catch (e) {
			console.log("Api Coinmarket Problem" + e);
			return
		}
		var marketcapInfo = dataCoin[0];
		data.priceUSD  = marketcapInfo['price_usd'];

		fs.writeFile("data/usdprice.txt",data.priceUSD,(err)=>{
			if(err) throw err;
			//console.log('File with price was updated');
		});
	});
}

function getBitzPrice(ticker) {
	const URL = 'https://api.bit-z.com/api_v1/ticker?coin=' + ticker.toLowerCase() + '_btc';
	request(URL, (error, response, body) => {
		try {
			var dataCoin = JSON.parse(body);
		} catch (e) {
			console.log("Error: Fail to get Bit-z api:" + e);
			return
		}
		data.priceBTC = dataCoin.data['last'];

		getBtcPrice(function(btcUsd) {
			var usdPrice = data.priceBTC * btcUsd;

			fs.writeFile("data/usdprice.txt", usdPrice, (err)=>{
				if (err) {
					throw err;
				}
				console.log('File with price was updated');
			});
		});
	});
}

function getBtcPrice(callback) {
	const URL = "https://min-api.cryptocompare.com/data/price?fsym=BTC&tsyms=USD,JPY,EUR,KRW,EUR,JPY,GBP,BRL,CNY,AUD,CAD";

	request(URL, (error, response, body) => {
		try {
			var json = JSON.parse(body);
		} catch (e) {
			console.log("Error: Fail to get BTC price from cryptocompare.com:" + e);
			return
		}
		if (json["USD"] && callback) {
			callback(json["USD"]);
		}
		fs.writeFile("data/btcprice.txt", JSON.stringify(json, null, 2), (err)=>{
			if (err) {
				throw err;
			}
		});
	});
}

module.exports = {
	getCMCPrice,
	getBitzPrice
};
