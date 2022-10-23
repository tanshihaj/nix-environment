interface StringDevVariable {
	type: 'var'|'exported'
	value: string
}

interface ArrayDevVariable {
	type: 'array'
	value: any
}

function isStringDevVariable(obj: any): obj is StringDevVariable {
	if ((typeof obj.type) !== "string") {
		return false;
	}
	if (obj.type === 'var' || obj.type === 'exported') {
		return (typeof obj.value) === "string";
	}
	return false;
}

function isArrayDevVariable(obj: any): obj is ArrayDevVariable {
	if ((typeof obj.type) !== "string") {
		return false;
	}
	return obj.type === 'array';
}


interface DevVariables {
	[key: string]: StringDevVariable|ArrayDevVariable;
}

function isDevVariables(obj: any): obj is DevVariables {
	if ((typeof obj) !== "object") {
		return false;
	}
	for (const [envName, envValue] of Object.entries(obj)) {
		if (!isStringDevVariable(envValue) && !isArrayDevVariable(envValue)) {
			return false;
		}
	}
	return true;
}

interface DevEnv {
	variables: DevVariables
}

export function isDevEnv(obj: any): obj is DevEnv {
	return isDevVariables(obj.variables);
}