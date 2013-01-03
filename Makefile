
run:
	clear
	node app.js

clean:
	rm -fr node_modules

flushdb:
	redis-cli flushdb

.PHONY: clean
