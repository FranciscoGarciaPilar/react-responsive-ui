import React, { PureComponent, PropTypes } from 'react'
import ReactDOM from 'react-dom'
import styler from 'react-styling'
import classNames from 'classnames'

import { submit_parent_form } from './misc/dom'

export default class Text_input extends PureComponent
{
	state = {}

	static propTypes =
	{
		// Text field label
		label            : PropTypes.string,

		// HTML form input `name` attribute
		name             : PropTypes.string,

		// Text field value
		value            : PropTypes.string,

		// Is called when the `value` is edited
		onChange         : PropTypes.func.isRequired,

		// Disables the text field
		disabled         : PropTypes.bool,

		// Renders description text before the `<input/>`
		description      : PropTypes.string,

		// Renders an error message below the `<input/>`
		error            : PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),

		// If this flag is `true` then the `error` is shown.
		// If this flag is `false` then the `error` is not shown (even if passed).
		indicateInvalid  : PropTypes.bool,

		// HTML 5 placeholder (instead of a label)
		placeholder      : PropTypes.string,

		// `<textarea/>` instead of an `<input type="text"/>`
		multiline        : PropTypes.bool,

		// Sets HTML input `type` attribute to `email`
		email            : PropTypes.bool,

		// Sets HTML input `type` attribute to `password`
		password         : PropTypes.bool,

		// A manually specified `type` attribute
		type             : PropTypes.string.isRequired,

		// Autofocuses the input field
		focus            : PropTypes.bool,

		// `<textarea/>` `rows` attribute (row count, i.e. height)
		rows             : PropTypes.number.isRequired,

		// `<textarea/>` `cols` attribute (column count, i.e. width)
		cols             : PropTypes.number,

		// (exotic use case)
		// Falls back to a plain HTML input
		// when javascript is disabled (e.g. Tor)
		fallback  : PropTypes.bool.isRequired,

		// CSS style object
		style            : PropTypes.object,

		// CSS name
		className        : PropTypes.string,

		// CSS style object for `<input/>`
		inputStyle       : PropTypes.object,

		// CSS style object for the label
		labelStyle       : PropTypes.object
	}

	static defaultProps =
	{
		// `<textarea/>` row count
		rows : 2,

		// HTML input `type` attribute
		type : 'text',

		fallback : false
	}

	constructor()
	{
		super()

		this.autoresize  = this.autoresize.bind(this)
		this.on_change   = this.on_change.bind(this)
		this.on_key_down = this.on_key_down.bind(this)
	}

	// Client side rendering, javascript is enabled
	componentDidMount()
	{
		const { multiline, fallback } = this.props

		if (multiline)
		{
			this.setState({ autoresize: autoresize_measure(ReactDOM.findDOMNode(this.input)) })
		}

		if (fallback)
		{
			this.setState({ javascript: true })
		}
	}

	render()
	{
		const
		{
			name,
			value,
			label,
			labelStyle,
			description,
			error,
			indicateInvalid,
			fallback,
			disabled,
			style,
			className
		}
		= this.props

		let container_style = style

		if (label)
		{
			container_style = { ...styles.input_with_label, ...container_style }
		}

		const markup =
		(
			<div
				style={ container_style }
				className={ classNames
				(
					'rrui__text-input',
					{
						'rrui__rich'                       : fallback,
						'rrui__text-input--empty'          : this.is_empty(),
						'rrui__text-input--invalid'        : this.should_indicate_invalid(),
						'rrui__text-input--floating-label' : label,
						'rrui__text-input--disabled'       : disabled
					},
					className
				) }>

				{/* Description */}
				{ this.render_description() }

				{/* <input/> */}
				{ this.render_input({ name: false }) }

				{/* Input `<label/>`. */}
				{/* It is rendered after the input to utilize the
			       `input:focus + label` CSS selector rule */}
				{ !description && label &&
					<label
						className={ classNames('rrui__text-input__label',
						{
							// CSS selector performance optimization
							'rrui__text-input__label--empty'   : this.is_empty(),
							'rrui__text-input__label--invalid' : this.should_indicate_invalid()
						}) }
						style={ labelStyle ? { ...styles.label, ...labelStyle } : styles.label }>
						{ label }
					</label>
				}

				{/* Error message */}
				{ this.should_indicate_invalid() && this.render_error_message() }

				{/* Fallback in case javascript is disabled (no animated <label/>) */}
				{ fallback && !this.state.javascript && this.render_static() }
			</div>
		)

		return markup
	}

	render_description()
	{
		const { description } = this.props

		if (!description)
		{
			return
		}

		const markup =
		(
			<p className={ classNames('rrui__text-input__description') }>
				{ description }
			</p>
		)

		return markup
	}

	render_input(options = {})
	{
		const { placeholder, ref, name } = options

		const
		{
			value,
			multiline,
			focus,
			onChange,
			disabled,
			inputStyle,
			rows,
			cols,

			// Passthrough properties
			onBlur
		}
		= this.props

		const properties =
		{
			name        : name === false ? undefined : this.props.name,
			ref         : ref === false ? undefined : ref => this.input = ref,
			value       : (value === undefined || value === null) ? '' : value,
			placeholder : placeholder || this.props.placeholder,
			onChange    : this.on_change,
			onKeyDown   : this.on_key_down,
			onBlur,
			disabled,
			className   : classNames('rrui__text-input__field',
			{
				// CSS selector performance optimization
				'rrui__text-input__field--empty'     : this.is_empty(),
				'rrui__text-input__field--invalid'   : this.should_indicate_invalid(),
				'rrui__text-input__field--disabled'  : disabled,
				'rrui__text-input__field--multiline' : multiline
			}),
			style       : inputStyle ? { ...styles.input, ...inputStyle } : styles.input,
			autoFocus   : focus
		}

		if (multiline)
		{
			// maybe add autoresize for textarea (smoothly animated)
			return <textarea
				rows={ rows }
				cols={ cols }
				onInput={ this.autoresize }
				onKeyUp={ this.autoresize }
				{ ...properties }/>
		}

		return <input type={ this.get_input_type() } { ...properties }/>
	}

	render_error_message()
	{
		const { error } = this.props

		return <div className="rrui__text-input__error">{ error }</div>
	}

	// Fallback in case javascript is disabled (no animated <label/>)
	render_static()
	{
		const { label } = this.props

		const markup =
		(
			<div className="rrui__rich__fallback">
				{/* Description */}
				{ this.render_description() }

				{/* <input/> */}
				{ this.render_input({ placeholder: label, ref: false }) }

				{/* Error message */}
				{ this.should_indicate_invalid() && this.render_error_message() }
			</div>
		)

		return markup
	}

	// "text", "email", "password", etc
	get_input_type()
	{
		const { type, email, password } = this.props

		if (email)
		{
			return 'email'
		}

		if (password)
		{
			return 'password'
		}

		return type
	}

	// Whether the input is empty
	is_empty()
	{
		const { value } = this.props
		return !value || !value.trim()
	}

	// Whether should indicate that the input value is invalid
	should_indicate_invalid()
	{
		const { indicateInvalid, error } = this.props
		return indicateInvalid && error
	}

	// "keyup" is required for IE to properly reset height when deleting text
	autoresize(event)
	{
		const { autoresize } = this.state

		const element = event.target
		const current_scroll_position = window.pageYOffset

		element.style.height = 0

		let height = element.scrollHeight + autoresize.extra_height
		height = Math.max(height, autoresize.initial_height)

		element.style.height = height + 'px'

		window.scroll(window.pageXOffset, current_scroll_position)
	}

	on_change(event)
	{
		const { onChange } = this.props

		onChange(event.target.value)
	}

	on_key_down(event)
	{
		// Submit the form on Cmd + Enter (or Ctrl + Enter)
		if ((event.ctrlKey || event.metaKey) && event.keyCode === 13)
		{
			if (submit_parent_form(ReactDOM.findDOMNode(this.input)))
			{
				event.preventDefault()
			}
		}
	}

	focus()
	{
		ReactDOM.findDOMNode(this.input).focus()
	}
}

const styles = styler
`
	input
		font-size : inherit

	input_with_label
		position : relative

	label
		position : absolute

		-webkit-user-select : none
		-moz-user-select    : none
		-ms-user-select     : none
		user-select         : none

		pointer-events      : none
`

// <textarea/> autoresize (without ghost elements)
// https://github.com/javierjulio/textarea-autosize/blob/master/src/jquery.textarea_autosize.js
function autoresize_measure(element)
{
	const style = window.getComputedStyle(element)

	const extra_height =
		parseInt(style.borderTopWidth) +
		parseInt(style.borderBottomWidth)

	// Raw `.getBoundingClientRect().height` could be used here
	// to avoid rounding (e.g. `em`, `rem`, `pt`, etc),
	// but setting `.scrollHeight` has no non-rounded equivalent.
	const initial_height = Math.ceil(element.getBoundingClientRect().height) // element.offsetHeight
	// Apply height rounding
	element.style.height = initial_height + 'px'

	return { extra_height, initial_height }
}
