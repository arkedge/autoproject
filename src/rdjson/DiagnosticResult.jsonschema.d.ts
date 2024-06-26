/* eslint-disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

/**
 * Result of diagnostic tool such as a compiler or a linter.
 *  It's intended to be used as top-level structured format which represents a
 *  whole result of a diagnostic tool.
 */
export interface DiagnosticResult {
  diagnostics?: {
    /**
     * The diagnostic's message.
     */
    message?: string;
    /**
     * Location at which this diagnostic message applies.
     */
    location?: {
      /**
       * File path. It could be either absolute path or relative path.
       */
      path?: string;
      range?: Range;
    };
    /**
     * This diagnostic's severity.
     *  Optional.
     */
    severity?: string | number;
    source?: Source;
    /**
     * This diagnostic's rule code.
     *  Optional.
     */
    code?: {
      /**
       * This rule's code/identifier.
       */
      value?: string;
      /**
       * A URL to open with more information about this rule code.
       *  Optional.
       */
      url?: string;
    };
    /**
     * Suggested fixes to resolve this diagnostic.
     *  Optional.
     */
    suggestions?: {
      range?: Range1;
      /**
       * A suggested text which replace the range.
       *  For delete operations use an empty string.
       */
      text?: string;
    }[];
    /**
     * Experimental: If this diagnostic is converted from other formats,
     *  original_output represents the original output which corresponds to this
     *  diagnostic.
     *  Optional.
     */
    original_output?: string;
  }[];
  source?: Source1;
  /**
   * This diagnostics' overall severity.
   *  Optional.
   */
  severity?: string | number;
}
/**
 * Range in the file path.
 *  Optional.
 */
export interface Range {
  start?: Position;
  end?: Position1;
}
/**
 * Required.
 */
export interface Position {
  /**
   * Line number, starting at 1.
   *  Optional.
   */
  line?: number;
  /**
   * Column number, starting at 1 (byte count in UTF-8).
   *  Example: 'a𐐀b'
   *   The column of a: 1
   *   The column of 𐐀: 2
   *   The column of b: 6 since 𐐀 is represented with 4 bytes in UTF-8.
   *  Optional.
   */
  column?: number;
}
/**
 * end can be omitted. Then the range is handled as zero-length (start == end).
 *  Optional.
 */
export interface Position1 {
  /**
   * Line number, starting at 1.
   *  Optional.
   */
  line?: number;
  /**
   * Column number, starting at 1 (byte count in UTF-8).
   *  Example: 'a𐐀b'
   *   The column of a: 1
   *   The column of 𐐀: 2
   *   The column of b: 6 since 𐐀 is represented with 4 bytes in UTF-8.
   *  Optional.
   */
  column?: number;
}
/**
 * The source of this diagnostic, e.g. 'typescript' or 'super lint'.
 *  Optional.
 */
export interface Source {
  /**
   * A human-readable string describing the source of diagnostics, e.g.
   *  'typescript' or 'super lint'.
   */
  name?: string;
  /**
   * URL to this source.
   *  Optional.
   */
  url?: string;
}
/**
 * Range at which this suggestion applies.
 *  To insert text into a document create a range where start == end.
 */
export interface Range1 {
  start?: Position;
  end?: Position1;
}
/**
 * The source of diagnostics, e.g. 'typescript' or 'super lint'.
 *  Optional.
 */
export interface Source1 {
  /**
   * A human-readable string describing the source of diagnostics, e.g.
   *  'typescript' or 'super lint'.
   */
  name?: string;
  /**
   * URL to this source.
   *  Optional.
   */
  url?: string;
}
