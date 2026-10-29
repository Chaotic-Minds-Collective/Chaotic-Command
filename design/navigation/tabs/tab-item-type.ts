export type TabItem = {
  /**
   * unique value of the tab.
   */
  value: string;

  /**
   * text shown in the tab.
   */
  label: string;

  /**
   * optional count displayed next to the label.
   */
  count?: number;

  /**
   * disables the tab.
   */
  disabled?: boolean;
};
