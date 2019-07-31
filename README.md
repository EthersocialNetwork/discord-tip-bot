
# discord-tip-bot

Bot created for a discord channel.
Bot use web3.js, so you need to run local node or another opened geth node.

**Bot can:**
* send and receive ethereum from users.
* send ethereum to registered users.
* send ethereum to any address.
* register and change registration (all data about users saves in json file).
* check balance on given address.
* make rain (distibute some ethereum between registered and online users)
* shows bot balance.
* shows list of registered users.
* shows all commands.

## How to run
Change config.json file.
* Add your local node address.
* Add bot token (it will generate here - <https://discordapp.com/developers/applications/me>)
* Add or change path if you wanna use another path or file name.
* Add or change prefix, you can use "!","/","$" or any another string.

Run local node with:

	./geth --rpc
Then run bot with:
	
    node index.js
