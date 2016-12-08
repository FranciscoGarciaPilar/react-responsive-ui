import React, { Component, PropTypes } from 'react'
import ReactDOM from 'react-dom'
import styler from 'react-styling/flat'
import classNames from 'classnames'

import { is_reachable, submit_parent_form, get_scrollbar_width } from './misc/dom'

const add_padding_for_scrollbar = true
const show_selected_item_in_list = true

// Possible enhancements:
//
//  * Scroll the list scrollbar when navigating with Up/Down keys
//  * Position the selected element on top
//    (scroll the list upon opening until it's positioned on top)
//  * If the menu is close to a screen edge,
//    automatically reposition it so that it fits on the screen
//  * Maybe show menu immediately above the toggler
//    (like in Material design), not below it.
//
// https://material.google.com/components/menus.html

export default class Select extends Component
{
	static propTypes =
	{
		// A list of selectable options
		options    : PropTypes.arrayOf
		(
			PropTypes.shape
			({
				// Option value
				value : React.PropTypes.string.isRequired,
				// Option label
				label : React.PropTypes.string.isRequired,
				// Option icon
				icon  : React.PropTypes.node
			})
		),

		// HTML form input `name` attribute
		name       : PropTypes.string,

		// Default label (like "Choose")
		label      : PropTypes.string,

		// Disables this control
		disabled   : PropTypes.bool,

		// Selected option value
		value      : PropTypes.any,

		// Is called when an option is selected
		onChange   : PropTypes.func,

		// If this flag is set to `true`,
		// and `icon` is specified for a selected option,
		// then the selected option will be displayed
		// as icon only, without the label.
		concise    : PropTypes.bool,

		// If set to `true`, autocompletion is available
		// upon expanding the options list.
		autocomplete : PropTypes.bool,

		// Options list alignment ("left", "right")
		alignment  : PropTypes.oneOf(['left', 'right']),

		// If `menu` flag is set to `true`
		// then it's gonna be a dropdown menu
		// with `children` elements inside.
		menu       : PropTypes.bool,

		// If `menu` flag is set to `true`
		// then `toggler` is the dropdown menu button.
		toggler    : PropTypes.element,

		// If `scroll` is `false`, then options list
		// is not limited in height.
		// Is `true` by default (scrollable).
		scroll     : PropTypes.bool.isRequired,

		// If this flag is set to `true`,
		// then the dropdown expands itself upward.
		// (as opposed to the default downward)
		upward     : PropTypes.bool,

		// Maximum items fitting the options list height (scrollable).
		// Is `6` by default.
		maxItems  : PropTypes.number.isRequired,

		// transition_item_count_min : PropTypes.number,
		// transition_duration_min : PropTypes.number,
		// transition_duration_max : PropTypes.number
	}

	static defaultProps =
	{
		alignment : 'left',

		scroll : true,

		maxItems : 6,

		// transition_item_count_min : 1,
		// transition_duration_min : 60, // milliseconds
		// transition_duration_max : 100 // milliseconds
	}

	state = {}

	constructor(props, context)
	{
		super(props, context)

		this.toggle           = this.toggle.bind(this)
		this.document_clicked = this.document_clicked.bind(this)
		this.on_key_down      = this.on_key_down.bind(this)

		this.on_autocomplete_input_change = this.on_autocomplete_input_change.bind(this)
		this.on_key_down_in_container = this.on_key_down_in_container.bind(this)

		if (props.autocomplete)
		{
			if (!props.options)
			{
				throw new Error(`"options" property is required for an "autocomplete" select`)
			}

			this.state.filtered_options = props.options
		}

		if (props.children && !props.menu)
		{
			React.Children.forEach(props.children, function(element)
			{
				if (!element.props.value)
				{
					throw new Error(`You must specify "value" prop on each child of <Select/>`)
				}

				if (!element.props.label)
				{
					throw new Error(`You must specify "label" prop on each child of <Select/>`)
				}
			})
		}

		if (props.menu && !props.toggler)
		{
			throw new Error(`Supply a "toggler" component when enabling "menu" in <Select/>`)
		}

		if (!props.menu && !props.onChange)
		{
			throw new Error(`"onChange" property must be specified for <Select/>`)
		}
	}

	// Client side rendering, javascript is enabled
	componentDidMount()
	{
		document.addEventListener('click', this.document_clicked)

		this.setState({ javascript: true })
	}

	componentDidUpdate(previous_props, previous_state)
	{
		if (this.state.expanded !== previous_state.expanded)
		{
			if (this.state.expanded && this.should_animate())
			{
				if (this.state.height === undefined)
				{
					this.calculate_height()
				}
			}
		}
	}

	componentWillUnmount()
	{
		document.removeEventListener('click', this.document_clicked)
	}

	render()
	{
		const { upward, scroll, children, menu, toggler, alignment, autocomplete } = this.props
		const { filtered_options } = this.state
		const options = autocomplete ? filtered_options : this.props.options

		let list_style = upward ? style.list_upward : style.list_downward

		// Will be altered
		list_style = { ...list_style }

		switch (alignment)
		{
			case 'left':
				list_style.left = 0
				break

			case 'right':
				list_style.right = 0
				break

			default:
				throw new Error(`Unsupported alignment: "${alignment}"`)
		}

		if (!menu && scroll && this.state.list_height !== undefined)
		{
			list_style.maxHeight = this.state.list_height + 'px'
		}

		const overflow = scroll && options && this.overflown()

		let list_items

		// If a list of options is supplied as an array of `{ value, label }`,
		// then transform those elements to <buttons/>
		if (options)
		{
			list_items = options.map(({ value, label, icon }, index) => this.render_list_item({ value, label, icon, overflow }))
		}
		// Else, if a list of options is supplied as a set of child React elements,
		// then render those elements.
		else
		{
			list_items = React.Children.map(children, element => this.render_list_item({ element }))
		}

		const wrapper_style = { ...style.wrapper, textAlign: alignment }

		const markup =
		(
			<div
				ref={ref => this.select = ref}
				onKeyDown={this.on_key_down_in_container}
				style={ this.props.style ? { ...wrapper_style, ...this.props.style } : wrapper_style }
				className={classNames
				(
					'rrui__rich',
					'rrui__select',
					{
						'rrui__select--upward'    : upward,
						'rrui__select--expanded'  : this.state.expanded,
						'rrui__select--collapsed' : !this.state.expanded
					}
				)}>

				{/* List container */}
				<div style={style.container}>

					{/* Currently selected item */}
					{!menu && this.render_selected_item()}

					{/* Menu toggler */}
					{menu &&
						<div ref={ref => this.menu_toggler} style={style.menu_toggler}>
							{React.cloneElement(toggler, { onClick : this.toggle })}
						</div>
					}

					{/* The list of selectable options */}
					{/* Math.max(this.state.height, this.props.max_height) */}
					<ul
						ref={ref => this.list = ref}
						style={list_style}
						className={classNames
						(
							'rrui__select__options',
							{
								'rrui__select__options--expanded'             : this.state.expanded,
								'rrui__select__options--simple-left-aligned'  : !children && alignment === 'left',
								'rrui__select__options--simple-right-aligned' : !children && alignment === 'right'
							}
						)}>
						{list_items}
					</ul>
				</div>

				{/* Fallback in case javascript is disabled */}
				{!this.state.javascript && this.render_static()}
			</div>
		)

		return markup
	}

	render_list_item({ element, value, label, icon, overflow }) // , first, last
	{
		const { disabled, menu } = this.props
		const { selected } = this.state

		// If a list of options is supplied as a set of child React elements,
		// then extract values from their props.
		if (element)
		{
			value = element.props.value
		}

		const is_selected = value !== undefined && value === selected

		let list_item_style = { textAlign: 'left' }

		if (!show_selected_item_in_list && is_selected)
		{
			list_item_style.maxHeight = 0
			list_item_style.overflow  = 'hidden'
		}

		let item_style = style.list_item

		// on overflow the vertical scrollbar will take up space
		// reducing padding-right and the only way to fix that
		// is to add additional padding-right
		//
		// a hack to restore padding-right taken up by a vertical scrollbar
		if (overflow && add_padding_for_scrollbar)
		{
			item_style = { ...style.list.item }

			item_style.marginRight = get_scrollbar_width() + 'px'
		}

		let button

		// If a list of options is supplied as a set of child React elements,
		// then enhance those elements with extra props.
		if (element)
		{
			const extra_props =
			{
				style     : { ...item_style, ...element.props.style },
				className : classNames
				(
					'rrui__select__option',
					{
						'rrui__select__option--selected' : is_selected
					},
					element.props.className
				)
			}

			const onClick = element.props.onClick

			extra_props.onClick = (event) =>
			{
				if (menu)
				{
					this.toggle()
				}
				else
				{
					this.item_clicked(value, event)
				}

				if (onClick)
				{
					onClick(event)
				}
			}

			button = React.cloneElement(element, extra_props)
		}
		// Else, if a list of options is supplied as an array of `{ value, label }`,
		// then transform those options to <buttons/>
		else
		{
			button = <button
				type="button"
				onClick={event => this.item_clicked(value, event)}
				disabled={disabled}
				tabIndex="-1"
				className={classNames
				(
					'rrui__select__option',
					'rrui__button__button',
					{
						'rrui__select__option--selected' : is_selected
					}
				)}
				style={item_style}>
				{ icon && React.cloneElement(icon, { className: classNames(icon.props.className, 'rrui__select__option-icon') }) }
				{ label }
			</button>
		}

		const markup =
		(
			<li
				key={value}
				className={classNames
				({
					'rrui__select__separator-option' : element && element.type === Select.Separator
				})}
				style={list_item_style}>
				{button}
			</li>
		)

		return markup
	}

	render_selected_item()
	{
		const { options, children, value, label, disabled, autocomplete, concise } = this.props
		const { expanded, autocomplete_width, autocomplete_input_value } = this.state

		const selected_label = this.get_selected_item_label()

		if (autocomplete && expanded)
		{
			const markup =
			(
				<input
					type="text"
					ref={ref => this.autocomplete = ref}
					placeholder={selected_label || label}
					value={autocomplete_input_value}
					onChange={this.on_autocomplete_input_change}
					onKeyDown={this.on_key_down}
					style={{ width: autocomplete_width + 'px' }}
					className={classNames
					(
						'rrui__select__selected',
						'rrui__select__selected--autocomplete',
						{
							'rrui__select__selected--nothing' : !selected_label
						}
					)}/>
			)

			return markup
		}

		const selected = this.get_selected_item()

		const markup =
		(
			<button
				ref={ref => this.selected = ref}
				type="button"
				disabled={disabled}
				onClick={this.toggle}
				onKeyDown={this.on_key_down}
				className={classNames
				(
					'rrui__select__selected',
					'rrui__button__button',
					{
						'rrui__select__selected--nothing' : !selected_label
					}
				)}>

				{/* the label */}
				{ (concise && selected && selected.icon) ? selected.icon : (selected_label || label) }

				{/* an arrow */}
				<div
					className=".rrui__select__arrow"
					style={ expanded ? style.arrow_expanded : style.arrow }/>
			</button>
		)

		return markup
	}

	// supports disabled javascript
	render_static()
	{
		const { name, value, label, disabled, options, menu, toggler, children } = this.props

		if (menu)
		{
			return <div className="rrui__rich__fallback">{toggler}</div>
		}

		const markup =
		(
			<div className="rrui__rich__fallback">
				<select
					name={name}
					value={value === null ? undefined : value}
					disabled={disabled}
					onChange={event => {}}
					style={{ width: 'auto' }}>
					{
						options
						?
						options.map(item =>
						{
							return <option
								className="rrui__select__option"
								key={item.value}
								value={item.value}>
								{item.label}
							</option>
						})
						:
						React.Children.map(children, child =>
						{
							return <option
								className="rrui__select__option"
								key={child.props.value}
								value={child.props.value}>
								{child.props.label}
							</option>
						})
					}
				</select>
			</div>
		)

		return markup
	}

	get_selected_item()
	{
		const { options, value, children } = this.props

		if (options)
		{
			return options.filter(x => x.value === value)[0]
		}

		let selected

		React.Children.forEach(children, function(child)
		{
			if (child.props.value === value)
			{
				selected = child
			}
		})

		return selected
	}

	get_selected_item_label()
	{
		const { options } = this.props

		const selected = this.get_selected_item()

		if (selected)
		{
			if (options)
			{
				return selected.label
			}

			return selected.props.label
		}
	}

	overflown()
	{
		return this.props.options.length > this.props.maxItems
	}

	scrollable_list_height(state = this.state)
	{
		return (state.height - 2 * state.vertical_padding) * (this.props.maxItems / this.props.options.length) + state.vertical_padding
	}

	should_animate()
	{
		return true

		// return this.props.options.length >= this.props.transition_item_count_min
	}

	toggle(event, toggle_options = {})
	{
		if (event)
		{
			// Don't navigate away when clicking links
			event.preventDefault()

			// Not discarding the click event because
			// other expanded selects may be listening to it.
			// // Discard the click event so that it won't reach `document` click listener
			// event.stopPropagation() // doesn't work
			// event.nativeEvent.stopImmediatePropagation()
		}

		const { disabled, autocomplete, options, value } = this.props

		if (disabled)
		{
			return
		}

		const { expanded } = this.state

		if (!expanded && autocomplete)
		{
			this.setState
			({
				autocomplete_input_value: '',
				filtered_options: options
			})

			if (!this.state.autocomplete_width)
			{
				this.setState({ autocomplete_width: this.get_widest_label_width() })
			}
		}

		// Deferring expanding the select upon click
		// because document.onClick should finish first,
		// otherwise `event.target` may be detached from the DOM
		// and it would immediately toggle back to collapsed state.
		setTimeout(() =>
		{
			this.setState
			({
				expanded: !expanded
			})

			if (!expanded && options)
			{
				this.setState
				({
					selected: value || options[0].value
				})
			}

			if (autocomplete && !toggle_options.dont_focus_after_toggle)
			{
				setTimeout(() =>
				{
					if (expanded)
					{
						this.selected.focus()
					}
					else
					{
						this.autocomplete.focus()
					}
				},
				0)
			}
		},
		0)
	}

	item_clicked(value, event)
	{
		if (event)
		{
			event.preventDefault()
		}

		const { disabled, onChange, autocomplete } = this.props

		if (disabled)
		{
			return
		}

		if (autocomplete)
		{
			this.autocomplete.focus()
		}
		else
		{
			this.selected.focus()
		}

		onChange(value)

		this.toggle()
	}

	document_clicked(event)
	{
		// const { menu } = this.props

		const select_node = ReactDOM.findDOMNode(this.select)

		// const autocomplete = ReactDOM.findDOMNode(this.autocomplete)
		// const selected_value_node = ReactDOM.findDOMNode(this.selected)

		// Don't close the select if its expander button has been clicked,
		// or if autocomplete has been clicked.
		if (is_reachable(event.target, select_node))
		{
			return
		}

		// // Don't close the select if menu toggler has been clicked
		// if (menu && is_descendant(event.target, ReactDOM.findDOMNode(this.menu_toggler)))
		// {
		// 	return
		// }

		// // Don't close the select if a blank spot in the list was clicked
		// if (is_descendant(event.target, ReactDOM.findDOMNode(this.list)))
		// {
		// 	if (!event.target.classList.contains('select-item')
		// 		&& !find_ancestor_by_class(event.target, 'select-item'))
		// 	{
		// 		return
		// 	}
		// }

		this.setState({ expanded: false })
	}

	on_key_down_in_container(event)
	{
		if (event.ctrlKey || event.altKey || event.shiftKey || event.metaKey)
		{
			return
		}

		const { expanded, selected } = this.state

		switch (event.keyCode)
		{
			// Toggle on Tab out
			case 9:
				if (expanded)
				{
					this.toggle(undefined, { dont_focus_after_toggle: true })
				}
				return
		}
	}

	on_key_down(event)
	{
		if (event.ctrlKey || event.altKey || event.shiftKey || event.metaKey)
		{
			return
		}

		const { options, value, autocomplete } = this.props
		const { expanded, selected } = this.state

		// Maybe add support for `children` arrow navigation in future
		if (options)
		{
			switch (event.keyCode)
			{
				// Select the previous option (if present) on up arrow
				case 38:
					event.preventDefault()

					const previous = this.previous_selected_value()

					if (previous !== undefined)
					{
						return this.setState({ selected: previous })
					}

					return

				// Select the next option (if present) on down arrow
				case 40:
					event.preventDefault()

					const next = this.next_selected_value()

					if (next !== undefined)
					{
						return this.setState({ selected: next })
					}

					return

				// Collapse on Escape
				//
				// Maybe add this kind of support for "Escape" key in some future:
				//  hiding the item list, cancelling current item selection process
				//  and restoring the selection present before the item list was toggled.
				//
				case 27:
					// Collapse the list if it's expanded
					if (this.state.expanded)
					{
						this.toggle()

						// Restore focus when the list is collapsed
						setTimeout
						(() =>
						{
							this.selected.focus()
						},
						0)
					}

					return

				// on Enter
				case 13:
					// Choose the selected item on Enter
					if (expanded)
					{
						event.preventDefault()

						// If an item is selected
						// (which may not be a case
						//  when autocomplete is matching no items)
						if (selected)
						{
							// Choose the selected item
							this.item_clicked(selected)
							// And collapse the select
							this.toggle()
						}
					}
					// Else it should have just submitted the form on Enter,
					// but it wouldn't because the select element activator is a <button/>
					// therefore hitting Enter while being focused on it just pushes that button.
					// So submit the enclosing form manually.
					else
					{
						if (submit_parent_form(ReactDOM.findDOMNode(this.select)))
						{
							event.preventDefault()
						}
					}

					return

				// Open on Spacebar
				case 32:
					// Choose the selected item on Enter
					if (expanded)
					{
						// ... only if it's not an autocomplete
						if (!autocomplete)
						{
							event.preventDefault()

							if (selected)
							{
								this.item_clicked(selected)
								this.toggle()
							}
						}
					}
					// Expand the select otherwise
					else
					{
						event.preventDefault()
						this.toggle()
					}

					return
			}
		}
	}

	select(value)
	{
		this.setState({ selected: value })
	}

	// Get the previous value (relative to the currently selected value)
	previous_selected_value()
	{
		const { options } = this.props
		const { selected } = this.state

		let i = 0
		while (i < options.length)
		{
			if (options[i].value === selected)
			{
				if (i - 1 >= 0)
				{
					return options[i - 1].value
				}
			}
			i++
		}
	}

	// Get the next value (relative to the currently selected value)
	next_selected_value()
	{
		const { options } = this.props
		const { selected } = this.state

		let i = 0
		while (i < options.length)
		{
			if (options[i].value === selected)
			{
				if (i + 1 < options.length)
				{
					return options[i + 1].value
				}
			}
			i++
		}
	}

	// Calculates height of the expanded item list
	calculate_height()
	{
		const list_dom_node = ReactDOM.findDOMNode(this.list)
		const border = parseInt(window.getComputedStyle(list_dom_node).borderTopWidth)
		const height = list_dom_node.scrollHeight // + 2 * border // inner height + 2 * border

		const vertical_padding = parseInt(window.getComputedStyle(list_dom_node.firstChild).paddingTop)

		// const images = list_dom_node.querySelectorAll('img')

		// if (images.length > 0)
		// {
		// 	return this.preload_images(list_dom_node, images)
		// }

		const state = { height, vertical_padding, border }

		if (!this.props.menu && this.props.scroll && this.props.options && this.overflown())
		{
			state.list_height = this.scrollable_list_height(state)
		}

		this.setState(state)
	}

	get_widest_label_width()
	{
		// <ul/> -> <li/> -> <button/>
		const label = ReactDOM.findDOMNode(this.list).firstChild.firstChild

		const style = getComputedStyle(label)

		const width = parseFloat(style.width)
		const side_padding = parseFloat(style.paddingLeft)

		return width - 2 * side_padding
	}

	on_autocomplete_input_change(event)
	{
		const input = event.target.value

		const { options } = this.props

		const filtered_options = options.filter(({ value, label, verbose, icon }) =>
		{
			return (verbose || label).toLowerCase().indexOf(input.toLowerCase()) !== -1
		})

		this.setState
		({
			autocomplete_input_value: input,
			filtered_options,
			selected: filtered_options.length > 0 ? filtered_options[0].value : undefined
		})
	}

	// // https://github.com/daviferreira/react-sanfona/blob/master/src/AccordionItem/index.jsx#L54
	// // Wait for images to load before calculating maxHeight
	// preload_images(node, images)
	// {
	// 	let images_loaded = 0
	//
	// 	const image_loaded = () =>
	// 	{
	// 		images_loaded++
	//
	// 		if (images_loaded === images.length)
	// 		{
	// 			this.setState
	// 			({
	// 				height: this.props.expanded ? node.scrollHeight : 0
	// 			})
	// 		}
	// 	}
	//
	// 	for (let i = 0; i < images.length; i += 1)
	// 	{
	// 		const image = new Image()
	// 		image.src = images[i].src
	// 		image.onload = image.onerror = image_loaded
	// 	}
	// }
}

Select.Separator = function(props)
{
	return <div className="rrui__select__separator" style={style.separator}/>
}

const arrow_height = 0.35
const arrow_width = 0.4

const style = styler
`
	wrapper
		display        : inline-block
		vertical-align : bottom

	container
		position   : relative
		text-align : inherit

		-webkit-user-select : none
		-moz-user-select    : none
		-ms-user-select     : none
		user-select         : none

	arrow
		display  : inline-block

		width        : 0
		height       : 0

		margin-left   : 0.35em
		margin-bottom : 0.1em

		opacity: 0.7

		transition: opacity 100ms ease-out

		border-width : ${arrow_height}em ${arrow_width / 2}em 0 ${arrow_width / 2}em

		border-style       : solid
		border-left-color  : transparent
		border-right-color : transparent

		&expanded
			opacity: 0.3

	list
		position : absolute

		z-index  : 1

		margin          : 0
		padding         : 0
		list-style-type : none

		overflow-x : hidden

		background-color: white

		&downward
			// top  : 100%

			// when html page is overflown by a long list
			// this bottom margin takes effect
			margin-bottom : 1em

		&upward
			bottom: 100%

			// when html page is overflown by a long list
			// this top margin takes effect
			margin-top : 1em

		// &placeholder
		// 	position            : static
		// 	max-height          : 0
		// 	border-top-width    : 0
		// 	border-bottom-width : 0
		// 	opacity             : 1
		// 	visibility          : hidden

	list_item
		display     : inline-block
		white-space : nowrap

	menu_toggler
		display : inline-block

	separator
		padding     : 0
		line-height : 0
		font-size   : 0
`