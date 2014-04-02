/*
* Object
* |- Node
*    |- DocumentFragment
*    |- Element             // skip
*    |  |- HTMLElement
*    |     |- HTML*Element  // skip
*    |- CharacterData       // skip
*    |  |- Text
*/



function extend(obj, _super, extras) {
	obj.prototype = Object.create(_super.prototype)
	for (var key in extras) {
		obj.prototype[key] = extras[key]
	}
	obj.prototype.constructor = obj
}



/*
* http://dom.spec.whatwg.org/#node
*/
function Node(){}

Node.prototype = {
	nodeName:        null,
	parentNode:      null,
	ownerDocument:   null,
	childNodes:      null,
	get textContent() {
		return this.hasChildNodes() ? this.childNodes.map(function(child){
			return child[ child.nodeType == 3 ? "data" : "textContent" ]
		}).join("") : this.nodeType === 3 ? this.data : ""
	},
	set textContent(text) {
		for (var self = this; self.firstChild;) self.removeChild(self.firstChild)
		self.appendChild(self.ownerDocument.createTextNode(text))
	},
	get firstChild() {
		return this.childNodes && this.childNodes[0] || null
	},
	get lastChild() {
		return this.childNodes[ this.childNodes.length - 1 ] || null
	},
	get previousSibling() {
		var self = this
		, childs = self.parentNode && self.parentNode.childNodes
		, index = childs && childs.indexOf(self) || 0

		return index > 0 && childs[ index - 1 ] || null
	},
	get nextSibling() {
		var self = this
		, childs = self.parentNode && self.parentNode.childNodes
		, index = childs && childs.indexOf(self) || 0

		return childs && childs[ index + 1 ] || null
	},
	get innerHTML() {
		return Node.prototype.toString.call(this)
	},
	get outerHTML() {
		return this.toString()
	},
	hasChildNodes: function() {
		return this.childNodes && this.childNodes.length > 0
	},
	appendChild: function(el) {
		return this.insertBefore(el)
	},
	insertBefore: function(el, ref) {
		var self = this
		, childs = self.childNodes

		if (el.nodeType == 11) {
			while (el.firstChild) self.insertBefore(el.firstChild, ref)
		} else {
			if (el.parentNode) el.parentNode.removeChild(el)
			el.parentNode = self

			// If ref is null, insert el at the end of the list of children.
			childs.splice(ref ? childs.indexOf(ref) : childs.length, 0, el)
		}
		return el
	},
	removeChild: function(el) {
		var self = this
		, index = self.childNodes.indexOf(el)
		if (index == -1) throw new Error("NOT_FOUND_ERR")

		self.childNodes.splice(index, 1)
		el.parentNode = null
		return el
	},
	replaceChild: function(el, ref) {
		this.insertBefore(el, ref)
		return this.removeChild(ref)
	},
	cloneNode: function(deep) {
		var key
		, self = this
		, node = own(self.ownerDocument, new self.constructor(self.tagName || self.data))

		if (self.hasAttribute) {
			for (var i = 0, attrs = self.attributes, l = attrs.length; i < l; ++i) {
			  node.setAttribute(attrs[i].name, attrs[i].value)
			}
		}

		if (deep && self.hasChildNodes()) {
			node.childNodes = self.childNodes.map(function(child){
				return child.cloneNode(deep)
			})
		}
		return node
	},
	toString: function() {
		return this.hasChildNodes() ? this.childNodes.reduce(function (memo, node) {
			return memo + node
		}, "") : this.data || ""
	}
}


function DocumentFragment() {
	this.childNodes = []
}

extend(DocumentFragment, Node, {
	nodeType: 11,
	nodeName: "#document-fragment"
})


function HTMLElement(tag) {
	var self = this
	, prop_regex = /^\s*(.*?):\s*(.*)?\s*$/
	, attrs = []
	, style_attr = {
		name: "style",
		get value() {
			return Object.keys(self.style).map(function(key) {
				return key + ": " + self.style[key] + ";"
			}).join(" ")
		},
		set value(value) {
			var match
			, attr = self.getAttribute("style")
			self.style = value.split(";").reduce(function(style, prop) {
				if(!(match = prop.match(prop_regex))) return style
				style[match[1]] = match[2]
				return style
			}, {})
		}
	}

	self.nodeName = self.tagName = tag.toLowerCase()
	self.childNodes = []
	self.style = {}
	Object.defineProperty(self, "attributes", {
		get: function() {
			if (!Object.keys(self.style).length) return attrs
			var _attrs = attrs.concat(style_attr)
			_attrs.push = attrs.push.bind(attrs)
			_attrs.splice = attrs.splice.bind(attrs)
			return _attrs
		}
	})
	Object.defineProperty(self, "id", {
		get: function() {
			return this.attributes ? this.getAttribute("id") || "" : ""
		},
		set: function(id) {
			id ? this.setAttribute("id", id) : this.removeAttribute("id")
		}
	})
	Object.defineProperty(self, "className", {
		get: function() {
			return this.attributes ? this.getAttribute("class") || "" : ""
		},
		set: function(name) {
			name ? this.setAttribute("class", name) : this.removeAttribute("class")
		}
	})
}

var elRe = /([.#:[])([-\w]+)(?:=([-\w]+)])?]?/g

function findEl(node, sel, first) {
	var el
	, i = 0
	, out = []
	, rules = ["_"]
	, tag = sel.replace(elRe, function(_, o, s, v) {
		rules.push(
			o == "." ? "(' '+_.className+' ').indexOf(' "+s+" ')>-1" :
			o == "#" ? "_.id=='"+s+"'" :
			"_.getAttribute('"+s+"')"+(v?"=='"+v+"'":"")
		)
		return ""
	}) || "*"
	, els = node.getElementsByTagName(tag)
	, fn = Function("_", "return " + rules.join("&&"))

	for (; el = els[i++]; ) if (fn(el)) {
		if (first) return el
		out.push(el)
	}
	return first ? null : out
}

/*
* Void elements:
* http://www.w3.org/html/wg/drafts/html/master/syntax.html#void-elements
*/
var voidElements = {
	area:1, base:1, br:1, col:1, embed:1, hr:1, img:1, input:1,
	keygen:1, link:1, menuitem:1, meta:1, param:1, source:1, track:1, wbr:1
}

function attributesToString(node) {
	var attrs = node.attributes.map(function(attr) {
		return attr.name + '="' + attr.value + '"'
	})

	return attrs.length ? " " + attrs.join(" ") : ""
}

extend(HTMLElement, Node, {
	nodeType: 1,
	tagName: null,
	style: null,
	hasAttribute: function(name) {
		return !!this.getAttribute(name)
	},
	getAttribute: function(name) {
		for(var i = 0, attrs = this.attributes, l = attrs.length; i < l; ++i) {
		  if (attrs[i].name === name) return attrs[i].value
		}
		return null
	},
	setAttribute: function(name, value) {
		var attr
		if(name === "style") {
			this.style.temp = ""
		}
		for(var i = 0, attrs = this.attributes, l = attrs.length; i < l; ++i) {
			if (attrs[i].name === name) {
				attr = attrs[i]
				break
		  }
		}
		attr ? attr.value = value : attrs.push({name: name, value: value})
	},
	removeAttribute: function(name) {
		if (name === "style") {
			return this.style = {}
		}
		for(var i = 0, attrs = this.attributes, l = attrs.length; i < l; ++i) {
		  if (attrs[i].name === name) return attrs.splice(i, 1)
		}
	},
	getElementById: function(id) {
		if (this.id == id) return this
		for (var el, found, i = 0; !found && (el = this.childNodes[i++]);) {
			if (el.nodeType == 1) found = el.getElementById(id)
		}
		return found || null
	},
	getElementsByTagName: function(tag) {
		var el, els = [], next = this.firstChild
		tag = tag === "*" ? 1 : tag.toLowerCase()
		for (var i = 0, key = tag === 1 ? "nodeType" : "nodeName"; (el = next); ) {
			if (el[key] === tag) els[i++] = el
			next = el.firstChild || el.nextSibling
			while (!next && (el = el.parentNode)) next = el.nextSibling
		}
		return els
	},
	querySelector: function(sel) {
		return findEl(this, sel, 1)
	},
	querySelectorAll: function(sel) {
		return findEl(this, sel)
	},
	toString: function() {
		return "<" + this.tagName + attributesToString(this) + ">"
			+ (voidElements[this.tagName] ? "" : this.innerHTML + "</" + this.tagName + ">" )
	}
})


function Text(data) {
	this.data = data
}

extend(Text, Node, {
	nodeType: 3,
	nodeName: "#text"
})

function Comment(data) {
	this.data = data
}

extend(Comment, Node, {
	nodeType: 8,
	nodeName: "#comment",
	toString: function() {
		return "<!--" + this.data + "-->"
	}
})

function Document(){
	this.body = this.createElement("body")
}

function own(self, node) {
	node.ownerDocument = self
	return node
}

extend(Document, Node, {
	nodeType: 9,
	nodeName: "#document",
	createElement: function(tag) {
		return own(this, new HTMLElement(tag))
	},
	createTextNode: function(value) {
		return own(this, new Text(value))
	},
	createComment: function(value) {
		return own(this, new Comment(value))
	},
	createDocumentFragment: function() {
		return own(this, new DocumentFragment())
	},
	getElementById: function(id) {
		return this.body.getElementById(id)
	},
	getElementsByTagName: function(tag) {
		return this.body.getElementsByTagName(tag)
	},
	querySelector: function(sel) {
		return this.body.querySelector(sel)
	},
	querySelectorAll: function(sel) {
		return this.body.querySelectorAll(sel)
	}
})

module.exports = {
	document: new Document,
	Document: Document,
	HTMLElement: HTMLElement
}

