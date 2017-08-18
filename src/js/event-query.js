/*
 * Helpers encapsulate querying WCL for events
 */

class QuerySpec {
	
	/*
	 * reportCode - report code to use with query
	 * startTime, endTime - time bounds on the query
	 * actorId - if specified, restricts query to events involving the given actor
	 */
	constructor(reportCode, startTime, endTime, actorId=null) {
		this.reportCode = reportCode;
		this.startTime = startTime;
		this.currTime = startTime;
		this.endTime = endTime;
		this.actorId = actorId;
	}
	
	getProgress() {
		return (this.currTime - this.startTime) / (this.endTime - this.startTime);
	}
	
}
 
class EventQueryWorker {
	
	constructor(apiKey, querySpec, eventCallback) {
		this.apiKey = apiKey;
		this.querySpec = querySpec;
		this.eventCallback = eventCallback;
	}

	getEventPromise() {
		return new Promise((resolve, reject) =>
				this.fetchPage(this.querySpec.startTime, resolve, reject));
	}
	
	// update progress, query next page and hand off to parse,
	// exit with error callback if there's a problem
	fetchPage(currTime, resolve, reject) {
		this.querySpec.currTime = currTime;
		
		let url = "https://www.warcraftlogs.com/v1/report/events/" + this.querySpec.reportCode +
		    "?api_key=" + this.apiKey +
		    "&start=" + currTime +
		    "&end=" + this.querySpec.endTime;
		if(this.querySpec.actorId !== null) {
			url += "&actorid=" + this.querySpec.actorId
		}

		$.getJSON(url)
				.done( data => this.parsePage(data, resolve, reject) )
				.fail( this.reject ); // TODO wrap as error?
	}
		
	// iterate through events in page, handing off to eventCallback
	// if there's more, fetch next page, if not call the doneCallback and exit
	parsePage(data, resolve, reject) {
		for(let wclEvent of data.events) {
			this.eventCallback(wclEvent);
		}
		
		if("nextPageTimestamp" in data) {
			this.fetchPage(data.nextPageTimestamp, resolve, reject);
		} else {
			resolve();
		}
	}
		
}
 
class EventQueryFactory {
	
	// apiKey to use when making query
	constructor(apiKey) {
		this.apiKey = apiKey;
	}
	
	/*
	 * querySpec - specification of query parameters
	 * eventCallback - function will be fed the wclEvents returned by this query
	 * 			one at a time (and in chronological order)
	 */
	executeQuery(querySpec, eventCallback) {
		let worker = new EventQueryWorker(this.apiKey, querySpec, eventCallback);
		return worker.getEventPromise();
	}
	
}

// TODO find syntax conflict with export
//export EventQueryFactory;