
run:
	clear
	redis-cli flushdb
	node app.js

clean:
	rm -fr node_modules

.PHONY: clean
