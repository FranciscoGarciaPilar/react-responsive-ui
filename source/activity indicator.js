// http://codepen.io/jczimm/pen/vEBpoL

import React, { PropTypes } from 'react'
import styler from 'react-styling'
import classNames from 'classnames'

const radius = 20
const padding = 0.25 // in `radius`es

const svg_circe_center = radius * (1 + padding)
const svg_canvas_dimensions = `0 0 ${svg_circe_center * 2} ${svg_circe_center * 2}`
// Whatever it is
// https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-miterlimit
const svg_stroke_miter_limit = radius / 2

export default function Activity_indicator({ className, style })
{
	const markup =
	(
		<div
			className={ classNames('rrui__activity-indicator', className) }
			style={ style }>
			<svg viewBox={ svg_canvas_dimensions }>
				<circle
					style={ styles.path }
					cx={ svg_circe_center }
					cy={ svg_circe_center }
					r={ radius }
					fill="none"
					strokeWidth={ radius * 0.125 }
					strokeMiterlimit={ svg_stroke_miter_limit }/>
			</svg>
		</div>
	)

	return markup
}

Activity_indicator.propTypes =
{
	// CSS class
	className : PropTypes.string,

	// CSS style object
	style     : PropTypes.object
}

const styles = styler
`
	path
		stroke-dashoffset : 0
		stroke-linecap    : round
		transition        : all 1.5s ease-in-out
`