/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Labs Floating SVG Shapes Background
 * Renders non-interactive geometric shapes (#FCC934 clover, #FFBDF9 square,
 * #FF864A & #48F08B hexagons, #5E9BFF circles) when the "Labs" theme is active.
 */

import React from 'react';

export const LabsThemeBackground: React.FC = () => {
  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden -z-10 select-none"
      aria-hidden="true"
    >
      {/* Top-left Clover (#FCC934) */}
      <svg
        viewBox="0 0 326 326"
        className="absolute -top-12 left-[4%] w-52 h-52 opacity-40 gl-float-shape"
        style={{ '--gl-dur': '11s', '--gl-delay': '0s' } as React.CSSProperties}
      >
        <path
          d="M89.8477 0C119.388 0 145.597 14.1722 161.972 36.0494C162.482 36.7304 163.51 36.7304 164.02 36.0495C180.396 14.1731 206.605 0.002 236.145 0.002C285.764 0.002 325.989 39.988 325.989 89.3135C325.989 119.25 311.171 145.745 288.429 161.95C287.716 162.459 287.716 163.528 288.429 164.036C311.172 180.241 325.992 206.737 325.992 236.675C325.992 286 285.767 325.986 236.147 325.986C206.606 325.986 180.395 311.813 164.019 289.933C163.509 289.252 162.481 289.252 161.971 289.933C145.596 311.813 119.386 325.987 89.8447 325.987C40.2252 325.987 0 286.001 0 236.676C0 206.737 14.8197 180.24 37.5637 164.035C38.2774 163.527 38.2775 162.458 37.5638 161.949C14.8217 145.744 0.0039 119.249 0.0039 89.3115C0.0039 39.986 40.2281 0 89.8477 0Z"
          fill="#FCC934"
        />
      </svg>

      {/* Top-right Circle (#5E9BFF) */}
      <svg
        viewBox="0 0 322 322"
        className="absolute top-[10%] right-[6%] w-48 h-48 opacity-35 gl-float-shape"
        style={{ '--gl-dur': '13s', '--gl-delay': '-2.5s' } as React.CSSProperties}
      >
        <circle cx="161" cy="161" r="160" fill="#5E9BFF" />
      </svg>

      {/* Bottom-left Hexagon (#48F08B) */}
      <svg
        viewBox="0 0 321 357"
        className="absolute bottom-[8%] left-[6%] w-56 h-56 opacity-35 gl-float-shape"
        style={{ '--gl-dur': '12s', '--gl-delay': '-4s' } as React.CSSProperties}
      >
        <path
          d="M132.896 7.43243C149.932 -2.47747 170.922 -2.47748 187.958 7.43242L293.323 68.7223C310.359 78.6322 320.854 96.9465 320.854 116.766L320.854 239.346C320.854 259.166 310.359 277.48 293.323 287.39L187.958 348.68C170.922 358.59 149.932 358.59 132.896 348.68L27.5311 287.39C10.4948 277.48 0 259.166 0 239.346L0 116.766C0 96.9465 10.4948 78.6322 27.5311 68.7223L132.896 7.43243Z"
          fill="#48F08B"
        />
      </svg>

      {/* Center-bottom Rounded Square (#FFBDF9) */}
      <svg
        viewBox="0 0 321 321"
        className="absolute bottom-[12%] left-[34%] w-44 h-44 opacity-35 gl-float-shape"
        style={{ '--gl-dur': '10s', '--gl-delay': '-1.5s' } as React.CSSProperties}
      >
        <rect x="0" y="0" width="321" height="321" rx="60" fill="#FFBDF9" />
      </svg>

      {/* Bottom-right Hexagon (#FF864A) */}
      <svg
        viewBox="0 0 321 357"
        className="absolute bottom-[10%] right-[12%] w-52 h-52 opacity-35 gl-float-shape"
        style={{ '--gl-dur': '14s', '--gl-delay': '-6s' } as React.CSSProperties}
      >
        <path
          d="M132.896 7.43243C149.932 -2.47747 170.922 -2.47748 187.958 7.43242L293.323 68.7223C310.359 78.6322 320.854 96.9465 320.854 116.766L320.854 239.346C320.854 259.166 310.359 277.48 293.323 287.39L187.958 348.68C170.922 358.59 149.932 358.59 132.896 348.68L27.5311 287.39C10.4948 277.48 0 259.166 0 239.346L0 116.766C0 96.9465 10.4948 78.6322 27.5311 68.7223L132.896 7.43243Z"
          fill="#FF864A"
        />
      </svg>
    </div>
  );
};
