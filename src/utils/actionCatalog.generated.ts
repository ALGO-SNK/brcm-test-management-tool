/**
 * Auto-generated from ACTION_PARAMETER_MATRIX.md and ACTION_PARAMETER_APPENDIX.md
 * Do not edit manually.
 */

export const DOC_ACTION_DEFINITIONS = {
  "ACCEPT_ALERT": {
    "name": "ACCEPT_ALERT",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Accepts the current alert. In GetElement, missing alert is tolerated when ExpectedValue=true.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "ADD_BAND_DATA": {
    "name": "ADD_BAND_DATA",
    "category": "business",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Deleted Items and Other Business-Specific Actions)",
    "notes": "Group helper: creates band rows until the count is at least 5. Page-state-driven.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "ADD_DAYS": {
    "name": "ADD_DAYS",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "If Headers is not today, it is parsed as the base date.",
    "contract": {
      "element": "optional",
      "elementCategory": "optional",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "ADD_EDIT_PHONE_EMAIL": {
    "name": "ADD_EDIT_PHONE_EMAIL",
    "category": "business",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Deleted Items and Other Business-Specific Actions)",
    "notes": "Communication helper: Key selects email vs phone flow. Value is the new email/phone. Copy a working pattern.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "ADD_GROUP_DETAIL_DATA_IF_NOT_EXIST": {
    "name": "ADD_GROUP_DETAIL_DATA_IF_NOT_EXIST",
    "category": "business",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Deleted Items and Other Business-Specific Actions)",
    "notes": "Group helper: Headers is a mini DSL containing raw click XPaths and commands like TYPE:days:xpath, STYPE:text:xpath, DATEPICK:days:iconXpath:calendarXpath.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "ADD_INTERVENTION_DATA": {
    "name": "ADD_INTERVENTION_DATA",
    "category": "business",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Deleted Items and Other Business-Specific Actions)",
    "notes": "Group helper: creates intervention rows until the count is at least 3. Page-state-driven.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "ADD_MULTIPLE_NUMBERS": {
    "name": "ADD_MULTIPLE_NUMBERS",
    "category": "compare",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Dictionary, Comparison, and Calculation Actions)",
    "notes": "Sums multiple saved numbers or list items. If Headers=SAVEADDEDVALUES, saves the result under Value; otherwise compares it to the current element text.",
    "contract": {
      "element": "optional",
      "elementCategory": "optional",
      "value": "optional",
      "expectedValue": "optional",
      "key": "required",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "ADD_OR_TRANSFER_BALANCE_TO_MAKE_POSITIVE": {
    "name": "ADD_OR_TRANSFER_BALANCE_TO_MAKE_POSITIVE",
    "category": "business",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Deleted Items and Other Business-Specific Actions)",
    "notes": "Payment helper: Value is the desired balance threshold. Remaining data is taken from fixed keys.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "ADD_ORDER_IF_NOT_PRESENT": {
    "name": "ADD_ORDER_IF_NOT_PRESENT",
    "category": "business",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Deleted Items and Other Business-Specific Actions)",
    "notes": "Payment helper: when table says No data available in table, it creates an order for the student from Value or Key.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "ADD_SCHEDULE_DATA_IF_NOT_EXIST": {
    "name": "ADD_SCHEDULE_DATA_IF_NOT_EXIST",
    "category": "business",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Deleted Items and Other Business-Specific Actions)",
    "notes": "Group helper: Headers is the existence-check XPath. If none found, the helper adds a schedule. Copy existing usage.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "ADD_TIME": {
    "name": "ADD_TIME",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Headers is SECOND, MINUTE, or HOUR.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "required",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "ADD_WITHDRAWAL_DATA": {
    "name": "ADD_WITHDRAWAL_DATA",
    "category": "business",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Deleted Items and Other Business-Specific Actions)",
    "notes": "Group helper: creates withdrawal rows until the count is at least 3. Page-state-driven.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "ALL_DATA_EXIST_IN_LIST": {
    "name": "ALL_DATA_EXIST_IN_LIST",
    "category": "compare",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Compare and Save Pattern Matrix)",
    "notes": "Checks whether all items equal the target value.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "optional",
      "expectedValue": "optional",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "ALL_TABLE_FILTER_ICON_VISIBLE": {
    "name": "ALL_TABLE_FILTER_ICON_VISIBLE",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Asserts all column filter icons are visible.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "ARITHMETIC_OPERATION_ON_NUMBER_AND_VERIFY": {
    "name": "ARITHMETIC_OPERATION_ON_NUMBER_AND_VERIFY",
    "category": "compare",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Dictionary, Comparison, and Calculation Actions)",
    "notes": "Headers controls mode: Multiply, Subtract, or default add/subtract. Default mode can also use Headers as an XPath source when Key is empty.",
    "contract": {
      "element": "optional",
      "elementCategory": "optional",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CALCULATE_ALLOWANCE": {
    "name": "CALCULATE_ALLOWANCE",
    "category": "compare",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Dictionary, Comparison, and Calculation Actions)",
    "notes": "Reads the first key, divides by 12, rounds, and stores into the second token from Key.",
    "contract": {
      "element": "optional",
      "elementCategory": "optional",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CALCULATE_BASIC": {
    "name": "CALCULATE_BASIC",
    "category": "compare",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Dictionary, Comparison, and Calculation Actions)",
    "notes": "Stores the calculated product under Value.",
    "contract": {
      "element": "optional",
      "elementCategory": "optional",
      "value": "required",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CALCULATE_PERCENTAGE": {
    "name": "CALCULATE_PERCENTAGE",
    "category": "compare",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Dictionary, Comparison, and Calculation Actions)",
    "notes": "Either saves the percentage result or compares it to the current element text.",
    "contract": {
      "element": "optional",
      "elementCategory": "optional",
      "value": "optional",
      "expectedValue": "optional",
      "key": "required",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CALCULATE_SALARY_PROJECTION_AMOUNT": {
    "name": "CALCULATE_SALARY_PROJECTION_AMOUNT",
    "category": "compare",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Dictionary, Comparison, and Calculation Actions)",
    "notes": "Compares the calculated salary projection amount to the current element text.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CALCULATE_SALARY_TOTAL": {
    "name": "CALCULATE_SALARY_TOTAL",
    "category": "compare",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Dictionary, Comparison, and Calculation Actions)",
    "notes": "Stores the calculated difference as a formatted number under Value.",
    "contract": {
      "element": "optional",
      "elementCategory": "optional",
      "value": "required",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CALCULATE_SAVE_DATE": {
    "name": "CALCULATE_SAVE_DATE",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Types DateTime.Now.AddYears(-1) in dd/MM/yyyy; saves the same date when Key exists.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CALCULATE_SUPERANNUATION": {
    "name": "CALCULATE_SUPERANNUATION",
    "category": "compare",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Dictionary, Comparison, and Calculation Actions)",
    "notes": "Either saves or compares the calculated result.",
    "contract": {
      "element": "optional",
      "elementCategory": "optional",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CANCEL_ALERT": {
    "name": "CANCEL_ALERT",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Dismisses the current alert.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CHANGE_INNER_HTML": {
    "name": "CHANGE_INNER_HTML",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Executes arguments[0].innerHTML = Value.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CHECK_BULK_GROUP_COLUMN_CHECKED": {
    "name": "CHECK_BULK_GROUP_COLUMN_CHECKED",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Uses Table.IsBulkAssignmentColumnCheck(element).",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CHECK_CUSTOM_CHECKBOX": {
    "name": "CHECK_CUSTOM_CHECKBOX",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Reads current state with CommonControls.IsCheckBoxSelected; clicks the custom control at Value only if state must change.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CHECK_DELETE_STUDENT_LIST_SORTED": {
    "name": "CHECK_DELETE_STUDENT_LIST_SORTED",
    "category": "business",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Deleted Items and Other Business-Specific Actions)",
    "notes": "Student helper: validates sorting against the deleted-student table variant.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CHECK_DELETED_LIST_SORTED": {
    "name": "CHECK_DELETED_LIST_SORTED",
    "category": "business",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Deleted Items and Other Business-Specific Actions)",
    "notes": "Staff helper: sorts saved column values and compares them to the current deleted-staff table.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CHECK_DELETED_STUDENT_LIST_SORTED": {
    "name": "CHECK_DELETED_STUDENT_LIST_SORTED",
    "category": "business",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Deleted Items and Other Business-Specific Actions)",
    "notes": "Student helper: validates deleted-student list sort order against saved data.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CHECK_IF_UNCHECKED": {
    "name": "CHECK_IF_UNCHECKED",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Clicks the element only if it is currently unchecked.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CHECK_LIST_ORDER": {
    "name": "CHECK_LIST_ORDER",
    "category": "list",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (List Action Matrix)",
    "notes": "Uses visible list text via GetListItemsViaContent.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CHECK_MANAGE_ATTENDANCE_CELL_SELECTED": {
    "name": "CHECK_MANAGE_ATTENDANCE_CELL_SELECTED",
    "category": "attendance",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Attendance and Marks Actions)",
    "notes": "Uses Table.IsManageAttendanceCellSelected.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CHECK_MANAGE_ATTENDANCE_ROW__PERIODS_ARE_SELECTED": {
    "name": "CHECK_MANAGE_ATTENDANCE_ROW__PERIODS_ARE_SELECTED",
    "category": "attendance",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Attendance and Marks Actions)",
    "notes": "Uses Table.GetManageAttendanceSelectedRowPeriodCount(element, rowCount).",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CHECK_STAFF_DELETED_ITEMS": {
    "name": "CHECK_STAFF_DELETED_ITEMS",
    "category": "business",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Deleted Items and Other Business-Specific Actions)",
    "notes": "Staff helper: compares one or more saved deleted-staff values against the current deleted-staff table.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CHECK_URL": {
    "name": "CHECK_URL",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Value is resolved through URLConstants if it is a key.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CHECKED": {
    "name": "CHECKED",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Uses element.Selected.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CLASS_VERIFY_ON_WHOLE_TABLE_BODY": {
    "name": "CLASS_VERIFY_ON_WHOLE_TABLE_BODY",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Uses the saved class from Key or the literal Value, then checks every table cell class for that fragment.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CLEAR_KEYS": {
    "name": "CLEAR_KEYS",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Removes one or more saved keys from DataStore.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CLEAR_TEXT": {
    "name": "CLEAR_TEXT",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Sends Ctrl+A then Delete.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CLICK": {
    "name": "CLICK",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "CLICK_DELAY first applies an explicit wait on Element.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CLICK_DELAY": {
    "name": "CLICK_DELAY",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "CLICK_DELAY first applies an explicit wait on Element.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CLICK_IF_PRESENT": {
    "name": "CLICK_IF_PRESENT",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Missing element is tolerated.",
    "contract": {
      "element": "optional",
      "elementCategory": "optional",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CLICK_INVISIBLE_ELEMENT": {
    "name": "CLICK_INVISIBLE_ELEMENT",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Uses JavaScript click.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CLOSE_TAB": {
    "name": "CLOSE_TAB",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Browser-only action in CommonPage; JavaScript close is used as fallback.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "COMPARE_DICTIONARY_VALUES": {
    "name": "COMPARE_DICTIONARY_VALUES",
    "category": "compare",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Dictionary, Comparison, and Calculation Actions)",
    "notes": "Compares two saved scalar values.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "COMPARE_ELEMENT_VALUE_WITH_REGEX": {
    "name": "COMPARE_ELEMENT_VALUE_WITH_REGEX",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Value may be select, childspan, or default element text mode.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "COMPARE_SAVED_ATTENDANCE_MARKS_OF_STUDENT": {
    "name": "COMPARE_SAVED_ATTENDANCE_MARKS_OF_STUDENT",
    "category": "attendance",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Attendance and Marks Actions)",
    "notes": "Re-reads mark cells using the same row XPath and compares the list to the saved list.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "COMPARE_SEARCH_COUNT": {
    "name": "COMPARE_SEARCH_COUNT",
    "category": "list",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (List, Filter, and Sort Actions)",
    "notes": "Value supports EQUAL, LESS_THEN, GREATER_THEN, otherwise not-equal. Compares current text/value against saved count.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "required",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "COMPARE_TWO_DATE": {
    "name": "COMPARE_TWO_DATE",
    "category": "date",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Date and Time Matrix)",
    "notes": "Currently documented mode seen in code: Less_Than_Equal.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "COMPARE_TWO_LISTS": {
    "name": "COMPARE_TWO_LISTS",
    "category": "compare",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Compare and Save Pattern Matrix)",
    "notes": "Headers can be Any, Equal, or default overlap logic.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "optional",
      "expectedValue": "optional",
      "key": "optional",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "COMPARE_TWO_TEXT": {
    "name": "COMPARE_TWO_TEXT",
    "category": "compare",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Compare and Save Pattern Matrix)",
    "notes": "Uses stored text from Key or direct Value.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "optional",
      "expectedValue": "optional",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "CURRENT_TAB": {
    "name": "CURRENT_TAB",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Switches to the first available handle.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "DATA_EXIST_IN_LIST": {
    "name": "DATA_EXIST_IN_LIST",
    "category": "compare",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Compare and Save Pattern Matrix)",
    "notes": "Key is split into list-key and fallback data-key.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "optional",
      "expectedValue": "optional",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "DATE_PICKER_SELCT_CUSTOM_DATE": {
    "name": "DATE_PICKER_SELCT_CUSTOM_DATE",
    "category": "date",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Date and Time Matrix)",
    "notes": "Parses explicit day, month, year.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "DATE_PICKER_SELECT_DATE": {
    "name": "DATE_PICKER_SELECT_DATE",
    "category": "date",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Date and Time Matrix)",
    "notes": "Delegates to DatePicker.SelectDate(element, offset, browser).",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "DELAY": {
    "name": "DELAY",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Static wait.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "required",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "DELETED_STUDENT_ROW_IS_SELECTED": {
    "name": "DELETED_STUDENT_ROW_IS_SELECTED",
    "category": "business",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Deleted Items and Other Business-Specific Actions)",
    "notes": "Delegates to Table.ValidateStudentDeletedRowSelection.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "DELETED_STUDENT_ROW_IS_UNSELECTED": {
    "name": "DELETED_STUDENT_ROW_IS_UNSELECTED",
    "category": "business",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Deleted Items and Other Business-Specific Actions)",
    "notes": "Delegates to Table.ValidateStudentDeletedRowUnSelection.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "DOES_NOT_CONTAIN": {
    "name": "DOES_NOT_CONTAIN",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Direct negative text assertion.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "DOUBLE_CLICK": {
    "name": "DOUBLE_CLICK",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Double-clicks the element.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "DOWNLOAD_FILE": {
    "name": "DOWNLOAD_FILE",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "If Headers exists it is used as the filename text instead of reading from the element.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "optional",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "DRAG_DROP": {
    "name": "DRAG_DROP",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Current implementation finds the XPath in Value and calls DragAndDrop(target, element). Copy an existing working test because source/target ordering is easy to misread.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "DRAG_DROP_BY_OFFSET": {
    "name": "DRAG_DROP_BY_OFFSET",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Uses Selenium DragAndDropToOffset with the two integers from Value.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "EDIT_MEAL_DEFINITION": {
    "name": "EDIT_MEAL_DEFINITION",
    "category": "business",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Deleted Items and Other Business-Specific Actions)",
    "notes": "Dinner helper: Headers selects one of the hard-coded scenarios such as Only All Groups, Not Assigned Group, In Assigned Group, In Two Assigned Group, MS Two Seperate Assigned Group.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "ELEMENTS_TO_BE_CLICKABLE": {
    "name": "ELEMENTS_TO_BE_CLICKABLE",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Present in the enum, but no runtime branch was found in the scanned execution path.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "ENTER_MARK": {
    "name": "ENTER_MARK",
    "category": "attendance",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Attendance and Marks Actions)",
    "notes": "Toggles the mark between ? and /, saves the previous mark in Key, and updates innerHTML directly.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "ENTER_MARK_IF_NOT_ENTERED": {
    "name": "ENTER_MARK_IF_NOT_ENTERED",
    "category": "attendance",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Attendance and Marks Actions)",
    "notes": "Changes the mark only if the current value does not equal Value. If Headers exists, it clicks that save button after updating.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "ENTER_SAVED_DATE": {
    "name": "ENTER_SAVED_DATE",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Reads a saved date from DataStore and types it into the element.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "EQUAL": {
    "name": "EQUAL",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Reads value, then Text, then textContent; trims whitespace/newlines.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "EQUAL_DELAY": {
    "name": "EQUAL_DELAY",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Reads value, then Text, then textContent; trims whitespace/newlines.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "FETCH_SHARED_STEPS": {
    "name": "FETCH_SHARED_STEPS",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Value is parsed as test case id and the shared step set is executed recursively.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "FILTER_BY": {
    "name": "FILTER_BY",
    "category": "list",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (List, Filter, and Sort Actions)",
    "notes": "Uses the #ListGrid header table and asserts all values in Headers column contain Value.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "required",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "FILTER_BY_DYNAMIC_VALUE": {
    "name": "FILTER_BY_DYNAMIC_VALUE",
    "category": "list",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (List, Filter, and Sort Actions)",
    "notes": "Same as FILTER_BY, but filter text comes from DataStore[Key].",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "FILTER_BY_MARK_MEANING": {
    "name": "FILTER_BY_MARK_MEANING",
    "category": "attendance",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Attendance and Marks Actions)",
    "notes": "Reads marks for one row via Table.GetManageAttendanceRowMarks and asserts at least one equals ExpectedValue.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "FILTER_ICON_CLICK": {
    "name": "FILTER_ICON_CLICK",
    "category": "list",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (List, Filter, and Sort Actions)",
    "notes": "Clicks the filter icon for the column named in Headers.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "GO_BACK": {
    "name": "GO_BACK",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Browser navigation only.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "HAS_AMMEND_ATTENDANCE_ICON": {
    "name": "HAS_AMMEND_ATTENDANCE_ICON",
    "category": "attendance",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Attendance and Marks Actions)",
    "notes": "Uses Table.HasAmmendDailyAttendanceIcon.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "HAS_COMMENT_ADDED": {
    "name": "HAS_COMMENT_ADDED",
    "category": "attendance",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Attendance and Marks Actions)",
    "notes": "Uses Table.HasAttendanceCommentAddedInGroupActions.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "HIDE_COLUMN_IF_VISIBLE": {
    "name": "HIDE_COLUMN_IF_VISIBLE",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Clicks only if the saved column-visibility key is true.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "HOVER": {
    "name": "HOVER",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Moves the mouse to the element. HOVER_DELAY only differs by the pre-wait path.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "HOVER_DELAY": {
    "name": "HOVER_DELAY",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Moves the mouse to the element. HOVER_DELAY only differs by the pre-wait path.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "IN_DATE_RANGE": {
    "name": "IN_DATE_RANGE",
    "category": "date",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Date and Time Matrix)",
    "notes": "Checks all dates in the named table column.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "INVERT_SELECTION_COUNT": {
    "name": "INVERT_SELECTION_COUNT",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Uses current selected-row count. When ExpectedValue is wrapped in @...@, the framework reads that element and subtracts Value from it.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "IS_CHECKBOX": {
    "name": "IS_CHECKBOX",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Asserts type=\"checkbox\".",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "IS_COLUMN_DATA_EMPTY": {
    "name": "IS_COLUMN_DATA_EMPTY",
    "category": "list",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (List, Filter, and Sort Actions)",
    "notes": "Same idea as IS_COLUMN_EMPTY, but uses a different grid header path.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "IS_COLUMN_EMPTY": {
    "name": "IS_COLUMN_EMPTY",
    "category": "list",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (List, Filter, and Sort Actions)",
    "notes": "When Value=true, all values in the column must be empty; otherwise all must be non-empty.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "IS_COLUMN_VISIBLE": {
    "name": "IS_COLUMN_VISIBLE",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Value=td toggles the table-cell mode. Saves or asserts visibility.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "optional",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "IS_DATEPICKER": {
    "name": "IS_DATEPICKER",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Asserts the class contains datePickerCustom.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "IS_ENABLED": {
    "name": "IS_ENABLED",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Direct element.Enabled comparison.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "IS_MULTIPLE_ELEMENT_VISIBLE": {
    "name": "IS_MULTIPLE_ELEMENT_VISIBLE",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Finds all children by the first XPath in Headers, then checks the nested XPath from the second token for each child.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "IS_ROW_SELECTED": {
    "name": "IS_ROW_SELECTED",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Uses Table.GetSelectedRowCount(element) and compares it to Value.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "IS_SCROLL_BAR": {
    "name": "IS_SCROLL_BAR",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Asserts the target has a scrollbar.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "IS_SORTED": {
    "name": "IS_SORTED",
    "category": "list",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (List, Filter, and Sort Actions)",
    "notes": "Current implementation asserts Table.IsSorted(element) is false. Treat it as a very narrow negative check.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "ISEMPTY": {
    "name": "ISEMPTY",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Checks the element value attribute.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "ISENABLED": {
    "name": "ISENABLED",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Wrapped in try/catch like ISVISIBLE.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "ISPASSWORD": {
    "name": "ISPASSWORD",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Checks whether the input type attribute is password.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "ISVISIBLE": {
    "name": "ISVISIBLE",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Missing element is tolerated when expected is false.",
    "contract": {
      "element": "optional",
      "elementCategory": "optional",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "ISVISIBLE_DELAY": {
    "name": "ISVISIBLE_DELAY",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Missing element is tolerated when expected is false.",
    "contract": {
      "element": "optional",
      "elementCategory": "optional",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "LIST_HAS_FUTURE_DATE_DATA": {
    "name": "LIST_HAS_FUTURE_DATE_DATA",
    "category": "list",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (List, Filter, and Sort Actions)",
    "notes": "At least one non-empty date in the column must be in the future.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "LIST_HAS_PREVIOUS_DATE_DATA": {
    "name": "LIST_HAS_PREVIOUS_DATE_DATA",
    "category": "list",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (List, Filter, and Sort Actions)",
    "notes": "Validates past dates in the named column. ANY means at least one past/blank value; otherwise all must be past/blank.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "MARK_ALL_PERIODS_FOR_ROW": {
    "name": "MARK_ALL_PERIODS_FOR_ROW",
    "category": "attendance",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Attendance and Marks Actions)",
    "notes": "Calls Table.MarkAllCellForNumberOfRows.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "MATCH_ADMISSION_NO_FROM_SAVED_DATA": {
    "name": "MATCH_ADMISSION_NO_FROM_SAVED_DATA",
    "category": "business",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Deleted Items and Other Business-Specific Actions)",
    "notes": "Uses saved \"Admission Number\" data and checks it against current \"Admission No\" values.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "MATCH_ATTENDANCE_PERIOD_STRUCTURE": {
    "name": "MATCH_ATTENDANCE_PERIOD_STRUCTURE",
    "category": "attendance",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Attendance and Marks Actions)",
    "notes": "Uses a saved mark list and Table.GetManageAttendancePeriodsByDay(element, Headers). Non-A/P values must exist in the saved list.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "MATCH_FILTER_STATUS_COUNT": {
    "name": "MATCH_FILTER_STATUS_COUNT",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Key order is expected total, leaver count, current count. Asserts leaver + current == expected.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "MATCH_LIST_COUNT": {
    "name": "MATCH_LIST_COUNT",
    "category": "list",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (List, Filter, and Sort Actions)",
    "notes": "Current list count must equal the text of the XPath extracted from ExpectedValue.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "MATCH_MANAGE_ATTENDANCE_GROUP_NAME": {
    "name": "MATCH_MANAGE_ATTENDANCE_GROUP_NAME",
    "category": "attendance",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Attendance and Marks Actions)",
    "notes": "Current text/value/textContent must contain ExpectedValue.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "MATCH_PERIOD_DATA_WITH_CLASS": {
    "name": "MATCH_PERIOD_DATA_WITH_CLASS",
    "category": "business",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Deleted Items and Other Business-Specific Actions)",
    "notes": "Missing-register helper: compares saved weekday/timetable data to a viewed timetable window. Copy existing pattern.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "MATCH_RECIPIENT_DATA_BY_STUDENT": {
    "name": "MATCH_RECIPIENT_DATA_BY_STUDENT",
    "category": "business",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Deleted Items and Other Business-Specific Actions)",
    "notes": "Communication helper: matches saved student identifiers to current recipients and message type.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "MATCH_SELECTED_TABLE_ROW_COUNT": {
    "name": "MATCH_SELECTED_TABLE_ROW_COUNT",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Reads selected row count from table row classes.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "MATCH_STUDENT_DELETED_LIST": {
    "name": "MATCH_STUDENT_DELETED_LIST",
    "category": "business",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Deleted Items and Other Business-Specific Actions)",
    "notes": "Student helper: compares three saved columns against the deleted-student table.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "MATCH_TABLE_COULMN_DATA": {
    "name": "MATCH_TABLE_COULMN_DATA",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Compares current element values to a saved table dictionary keyed by Value.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "MATCH_TABLE_COULMN_DATA_BY_TEXT": {
    "name": "MATCH_TABLE_COULMN_DATA_BY_TEXT",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Reads a saved table dictionary and asserts each value in the named column contains Value.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "required",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "MATCH_TABLE_COUNT": {
    "name": "MATCH_TABLE_COUNT",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Expected count can come from Key, direct text, or another element.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "MATCH_TABLE_DROPOWN_DATA": {
    "name": "MATCH_TABLE_DROPOWN_DATA",
    "category": "list",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (List, Filter, and Sort Actions)",
    "notes": "Student helper: compares deleted-table column values against a saved dropdown list. Copy from an existing student flow.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "MATCH_TABLE_VALUE": {
    "name": "MATCH_TABLE_VALUE",
    "category": "list",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (List, Filter, and Sort Actions)",
    "notes": "Student helper: looks for a matching row in a specific confirm-student table. Copy a working pattern.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "MATCH_UNSELECTED_TABLE_ROW_COUNT": {
    "name": "MATCH_UNSELECTED_TABLE_ROW_COUNT",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Same idea for unselected rows.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "MAXIMIZE_WINDOW": {
    "name": "MAXIMIZE_WINDOW",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Handled directly in CommonPage; no element lookup.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "MULTIPLE_CLICK": {
    "name": "MULTIPLE_CLICK",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Defaults to 1 if empty or invalid.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "MULTIPLE_CLICK_DELAY": {
    "name": "MULTIPLE_CLICK_DELAY",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Defaults to 1 if empty or invalid.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "MULTIPLE_TIMES_PRESS_KEY": {
    "name": "MULTIPLE_TIMES_PRESS_KEY",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Count is taken from Key or Headers.",
    "contract": {
      "element": "optional",
      "elementCategory": "optional",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "NO_NEW_BOX_ADDED": {
    "name": "NO_NEW_BOX_ADDED",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Treats empty style as success and compares that to ExpectedValue.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "NOTSELECTED": {
    "name": "NOTSELECTED",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Asserts selected text is not the given value.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "OPEN_NEW_TAB": {
    "name": "OPEN_NEW_TAB",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Browser-only action in CommonPage.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "OVERVIEW_EMAIL_SENT_VERIFY": {
    "name": "OVERVIEW_EMAIL_SENT_VERIFY",
    "category": "business",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Deleted Items and Other Business-Specific Actions)",
    "notes": "Communication helper: checks message text, today's date, and Delivered status.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "POPUP_TEXT": {
    "name": "POPUP_TEXT",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Reads alert text and asserts it contains Value.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "PREFIX_CHECK": {
    "name": "PREFIX_CHECK",
    "category": "date",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Date and Time Matrix)",
    "notes": "Checks whether current text starts with Value.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "PRESS_KEY": {
    "name": "PRESS_KEY",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "CTRL uses ExpectedValue as the key chord suffix.",
    "contract": {
      "element": "optional",
      "elementCategory": "optional",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "PRESS_KEY_ON_TABLE_ROW": {
    "name": "PRESS_KEY_ON_TABLE_ROW",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Sends the given key once per row. It does not target an individual cell.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "REFRESH_CACHE": {
    "name": "REFRESH_CACHE",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Runs the permission helper flow to refresh system cache. No element contract.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "REFRESH_PAGE": {
    "name": "REFRESH_PAGE",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Browser navigation only.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "RELOGIN_INTO_SAGEPAY_IF_LOGGEDOUT": {
    "name": "RELOGIN_INTO_SAGEPAY_IF_LOGGEDOUT",
    "category": "business",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Deleted Items and Other Business-Specific Actions)",
    "notes": "Payment helper: no authored parameters beyond current page state. Copy an existing usage only.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "REMOVE_TRANSACTION_TO_MAKE_BALANCE_NEGATIVE": {
    "name": "REMOVE_TRANSACTION_TO_MAKE_BALANCE_NEGATIVE",
    "category": "business",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Deleted Items and Other Business-Specific Actions)",
    "notes": "Payment helper: page-state-driven corrective action. Copy existing usage only.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "RIGHT_CLICK": {
    "name": "RIGHT_CLICK",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Context-clicks the element.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_ATTENDANCE_MARKS_OF_STUDENT": {
    "name": "SAVE_ATTENDANCE_MARKS_OF_STUDENT",
    "category": "attendance",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Attendance and Marks Actions)",
    "notes": "Reads div text from all mark cells found under the row XPath in Headers and saves them as a list.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_CLASS_OF_ELEMENT": {
    "name": "SAVE_CLASS_OF_ELEMENT",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Headers may be SplitByBreak, SplitByCarriageReturn, or SplitBySpace.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_CURRENT_PERIOD": {
    "name": "SAVE_CURRENT_PERIOD",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Saves current period label built from current month + current year element.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_DATE_TIME": {
    "name": "SAVE_DATE_TIME",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Saves current dd/MM/yyyy HH:mm.",
    "contract": {
      "element": "optional",
      "elementCategory": "optional",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_DELETED_STUDENTS_TABLE_DATA": {
    "name": "SAVE_DELETED_STUDENTS_TABLE_DATA",
    "category": "business",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Deleted Items and Other Business-Specific Actions)",
    "notes": "Student helper: saves deleted-student table data.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_DELETED_TABLE_DATA": {
    "name": "SAVE_DELETED_TABLE_DATA",
    "category": "business",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Deleted Items and Other Business-Specific Actions)",
    "notes": "Staff helper: saves deleted-staff table data.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_DROPDOWN_LIST": {
    "name": "SAVE_DROPDOWN_LIST",
    "category": "list",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (List Action Matrix)",
    "notes": "Saves dropdown options.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_DROPDOWN_LIST_COUNT": {
    "name": "SAVE_DROPDOWN_LIST_COUNT",
    "category": "list",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (List Action Matrix)",
    "notes": "Saves option count.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_ELEMENT_ATTRIBUTES": {
    "name": "SAVE_ELEMENT_ATTRIBUTES",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Collects the named attribute from all child elements matched by Headers.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "required",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_ELEMENT_TITLE": {
    "name": "SAVE_ELEMENT_TITLE",
    "category": "compare",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Compare and Save Pattern Matrix)",
    "notes": "Saves the title attribute.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_ELEMENTS_ATTRIBUTE": {
    "name": "SAVE_ELEMENTS_ATTRIBUTE",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Saves one attribute from the current element.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_ELEMENTS_COUNT": {
    "name": "SAVE_ELEMENTS_COUNT",
    "category": "compare",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Compare and Save Pattern Matrix)",
    "notes": "Counts children matching Headers XPath under the current element.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_FILTER_LIST": {
    "name": "SAVE_FILTER_LIST",
    "category": "list",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (List, Filter, and Sort Actions)",
    "notes": "Present in the enum, but no runtime branch was found in the scanned execution path.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_GRID_COLUMN_DATA": {
    "name": "SAVE_GRID_COLUMN_DATA",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Reads ag-grid text by XPath.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_HARDCODE_DATA": {
    "name": "SAVE_HARDCODE_DATA",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Saves Value directly under Key.",
    "contract": {
      "element": "optional",
      "elementCategory": "optional",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_LIST_COUNT": {
    "name": "SAVE_LIST_COUNT",
    "category": "list",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (List Action Matrix)",
    "notes": "Saves visible list length from li elements.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_MID_DATE_FROM_DATE_MIN_MAX": {
    "name": "SAVE_MID_DATE_FROM_DATE_MIN_MAX",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Saves the latest non-empty date minus 14 days from the table column in Headers.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_SELECTED_ROW_IN_DICTIONARY": {
    "name": "SAVE_SELECTED_ROW_IN_DICTIONARY",
    "category": "compare",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Dictionary, Comparison, and Calculation Actions)",
    "notes": "Value must include tableheaderxpath; optional headercount stores {Key}_count. Saves the selected-row dictionary.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_SEPERATED_TEXT_IN_DICTIONARY": {
    "name": "SAVE_SEPERATED_TEXT_IN_DICTIONARY",
    "category": "compare",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Compare and Save Pattern Matrix)",
    "notes": "Splits element text and writes sequential keys like Key_1, Key_2.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_SPECIFIC_LIST_ITEMS": {
    "name": "SAVE_SPECIFIC_LIST_ITEMS",
    "category": "list",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (List Action Matrix)",
    "notes": "Headers is an XPath filter applied inside the list.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_SPECIFIC_ROW_COUNT": {
    "name": "SAVE_SPECIFIC_ROW_COUNT",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Headers first token is parsed as the target column index.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_SPECIFIC_TEXT": {
    "name": "SAVE_SPECIFIC_TEXT",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Supports chained split operations via comma-separated Headers and Value.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "optional",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_SPECIFIC_TEXT_OR_DEFAULT": {
    "name": "SAVE_SPECIFIC_TEXT_OR_DEFAULT",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Uses ExpectedValue as an alternate XPath to read from; falls back to 0.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "optional",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_STAFF_CODE": {
    "name": "SAVE_STAFF_CODE",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Generates a 3-character uppercase/random staff code, types it, and stores it.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_TABLE": {
    "name": "SAVE_TABLE",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "If Value contains tdInTableHeader, delete-row parsing is used.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_TABLE_COUNT": {
    "name": "SAVE_TABLE_COUNT",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Saves the element text directly; this is not the same as SAVE_TABLE_ROW_COUNT.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_TABLE_DATA": {
    "name": "SAVE_TABLE_DATA",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Saves row data as dictionary keyed by table header text.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_TABLE_ROW_COUNT": {
    "name": "SAVE_TABLE_ROW_COUNT",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Missing/null tables are treated as zero when Headers contains TableCanBeNull.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_TEXTBOX_VALUE_FROM_TABLE": {
    "name": "SAVE_TEXTBOX_VALUE_FROM_TABLE",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Saves every input value under the column whose header text equals Value.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_WEEK_NAME": {
    "name": "SAVE_WEEK_NAME",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Reads element value, parses dd/MM/yyyy, and stores the weekday name.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVE_XML_DATA_TO_LIST": {
    "name": "SAVE_XML_DATA_TO_LIST",
    "category": "xml",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (XML and File Matrix)",
    "notes": "Key contains multiple comma-separated keys.",
    "contract": {
      "element": "optional",
      "elementCategory": "optional",
      "value": "optional",
      "expectedValue": "optional",
      "key": "optional",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SAVEDATA": {
    "name": "SAVEDATA",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Saves Text, then value, then textContent.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SCHEDULE_EMAIL_SUBJECT_BODY_CHECK": {
    "name": "SCHEDULE_EMAIL_SUBJECT_BODY_CHECK",
    "category": "business",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Deleted Items and Other Business-Specific Actions)",
    "notes": "Communication helper: checks subject/body pair in the forgotten-people table.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SCROLL_TO_HORIZONTAL": {
    "name": "SCROLL_TO_HORIZONTAL",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Delegates to DomScriptsExecutor.ScrollByPixel(..., Headers, ExpectedValue, \"Horizontal\").",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SCROLL_TO_LEFT": {
    "name": "SCROLL_TO_LEFT",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Scrolls inside the target element horizontally.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SCROLL_TO_RIGHT": {
    "name": "SCROLL_TO_RIGHT",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Scrolls inside the target element horizontally.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SCROLL_TO_TOP": {
    "name": "SCROLL_TO_TOP",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Scrolls the page to top through DomScriptsExecutor.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SCROLL_TO_VERTICAL": {
    "name": "SCROLL_TO_VERTICAL",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Delegates to DomScriptsExecutor.ScrollByPixel(..., Headers, ExpectedValue, \"Vertical\").",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SCROLL_UNTIL_VISIBLE": {
    "name": "SCROLL_UNTIL_VISIBLE",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Repeatedly scrolls until the element is visible.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SEARCH_BY_SEARCH_FILTER": {
    "name": "SEARCH_BY_SEARCH_FILTER",
    "category": "list",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (List, Filter, and Sort Actions)",
    "notes": "All values in the named table column must equal Value.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "required",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SELECT": {
    "name": "SELECT",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "SELECT is executed in CommonPage as SelectElement, not generic IWebElement.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SELECT_BY_INDEX": {
    "name": "SELECT_BY_INDEX",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Defaults to 5 if empty.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SELECT_DELAY": {
    "name": "SELECT_DELAY",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "SELECT is executed in CommonPage as SelectElement, not generic IWebElement.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SELECT_DELETED_STUDENT_ROW": {
    "name": "SELECT_DELETED_STUDENT_ROW",
    "category": "business",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Deleted Items and Other Business-Specific Actions)",
    "notes": "Delegates to Table.SelectStudentDeletedRow(element, Value).",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SELECT_INCREMENTED_INDEX": {
    "name": "SELECT_INCREMENTED_INDEX",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Adds Value to current selected index.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SELECT_IS_SELECTED": {
    "name": "SELECT_IS_SELECTED",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Compares selected option text.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SELECT_LIST_ITEM": {
    "name": "SELECT_LIST_ITEM",
    "category": "list",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (List Action Matrix)",
    "notes": "Clicks a subset of li items.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SELECT_LIST_ITEM_BY_TEXT": {
    "name": "SELECT_LIST_ITEM_BY_TEXT",
    "category": "list",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (List Action Matrix)",
    "notes": "Uses text from Key if present.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SELECT_NEXT_INDEX": {
    "name": "SELECT_NEXT_INDEX",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Advances one index from current selection.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SELECT_SAVE_SELECTED_OPTION_TEXT": {
    "name": "SELECT_SAVE_SELECTED_OPTION_TEXT",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Saves the selected option text into DataStore.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SELECT_UNIQUE_MARK": {
    "name": "SELECT_UNIQUE_MARK",
    "category": "attendance",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Attendance and Marks Actions)",
    "notes": "Picks a unique mark via Helpers.GetUniqueMark(currentSelection) and optionally stores the previous mark.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SELECTED": {
    "name": "SELECTED",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Same data-source idea as SELECT_IS_SELECTED, but direct equality assertion.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SEND_KEYS_WITHOUT_ELEMENT": {
    "name": "SEND_KEYS_WITHOUT_ELEMENT",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Sends keyboard input globally through Selenium Actions.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SORT_BY": {
    "name": "SORT_BY",
    "category": "list",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (List, Filter, and Sort Actions)",
    "notes": "Sorts the saved table column in memory and compares it to the current UI column.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "required",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SWITCH_FRAME": {
    "name": "SWITCH_FRAME",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Uses Element if a frame element is resolvable; otherwise parses Value as frame index.",
    "contract": {
      "element": "optional",
      "elementCategory": "optional",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SWITCH_TAB": {
    "name": "SWITCH_TAB",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "If Value is empty, the framework switches to the next non-current tab.",
    "contract": {
      "element": "optional",
      "elementCategory": "optional",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "SWITCH_TO_PARENT_FRAME": {
    "name": "SWITCH_TO_PARENT_FRAME",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Browser frame navigation only.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_CHECK_DROPDOWN_STATUS": {
    "name": "TABLE_CHECK_DROPDOWN_STATUS",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Targets select controls by table column.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_CHECK_HEADERS_TEXT": {
    "name": "TABLE_CHECK_HEADERS_TEXT",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Supports row number and headerhasth flags in Value.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_CLICK_COLUMN_DIV_ICON": {
    "name": "TABLE_CLICK_COLUMN_DIV_ICON",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Clicks all matching icon components.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_CLICK_COLUMN_HEADER": {
    "name": "TABLE_CLICK_COLUMN_HEADER",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Value is 1-based.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_CLICK_COLUMN_ICON": {
    "name": "TABLE_CLICK_COLUMN_ICON",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Clicks a specific i icon.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_CLICK_ROW": {
    "name": "TABLE_CLICK_ROW",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Clicks rows by count or by take/skip dictionary.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_CLICK_ROWS": {
    "name": "TABLE_CLICK_ROWS",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Present in the enum, but no runtime branch was found in the scanned execution path.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_COLUMN_DIV_CLICK": {
    "name": "TABLE_COLUMN_DIV_CLICK",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Row/column can come from stored JSON coordinates or direct Value.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_COLUMN_DIV_DIV_ICON_CLICK": {
    "name": "TABLE_COLUMN_DIV_DIV_ICON_CLICK",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Finds the first icon under nested divs whose attribute contains findvalue, then clicks it through JavaScript.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_COLUMN_DIV_UPDATE_INNERHTML": {
    "name": "TABLE_COLUMN_DIV_UPDATE_INNERHTML",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Supports possibletext, sendkeys, and direct text.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_COLUMN_IS_CHECKED": {
    "name": "TABLE_COLUMN_IS_CHECKED",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "unused",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_COUNT_AFTER_DELETE": {
    "name": "TABLE_COUNT_AFTER_DELETE",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Asserts current integer text is saved count - 1.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_HEADER_COMPARE_COUNT": {
    "name": "TABLE_HEADER_COMPARE_COUNT",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Compares header count.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_HEADER_ICON_HAS_STYLE": {
    "name": "TABLE_HEADER_ICON_HAS_STYLE",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Present in the enum, but no runtime branch was found in the scanned execution path.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_HOVER_COLUMN_DIV_ICON": {
    "name": "TABLE_HOVER_COLUMN_DIV_ICON",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Supports skip, take, and iconnumber.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_HOVER_COLUMN_ICON": {
    "name": "TABLE_HOVER_COLUMN_ICON",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Hovers header/data icon element.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_MATCHES_ANY_ROW_VALUE": {
    "name": "TABLE_MATCHES_ANY_ROW_VALUE",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "At least one value in the named column must equal Value.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_ROW_SELECT": {
    "name": "TABLE_ROW_SELECT",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Saves selected rows as structured table data.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_SAVE_COLUMN_CLASS": {
    "name": "TABLE_SAVE_COLUMN_CLASS",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Saves a table cell class.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_SAVE_COLUMN_DATA": {
    "name": "TABLE_SAVE_COLUMN_DATA",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Uses Headers as column index.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "optional",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_SAVE_COLUMN_DIV_STYLE": {
    "name": "TABLE_SAVE_COLUMN_DIV_STYLE",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Saves a cell div style.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_SAVE_ROW_COLUMN_DIV_TEXT_IN_DICTIONARY": {
    "name": "TABLE_SAVE_ROW_COLUMN_DIV_TEXT_IN_DICTIONARY",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Saves one div text from a row/column coordinate.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_SAVE_ROW_COLUMN_SPAN_TEXT_IN_DICTIONARY": {
    "name": "TABLE_SAVE_ROW_COLUMN_SPAN_TEXT_IN_DICTIONARY",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Saves one span text from a row/column coordinate. spannumber defaults to 1.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_SAVE_ROW_COLUMN_WITH_MATCHED_STYLE": {
    "name": "TABLE_SAVE_ROW_COLUMN_WITH_MATCHED_STYLE",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Saves matching row,column coordinates as JSON plus {Key}_count.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_SAVE_ROW_DATA": {
    "name": "TABLE_SAVE_ROW_DATA",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Delegates to Table.GetWholeRowText(element, Headers). Copy a nearby example because Headers meaning comes from the helper.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_SAVE_VISIBLE_ROWS_COUNT": {
    "name": "TABLE_SAVE_VISIBLE_ROWS_COUNT",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Saves visible rows count.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_SELECT_CHECKBOX": {
    "name": "TABLE_SELECT_CHECKBOX",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Common inline format is columnNumber:5,take:5,skip:0.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_SELECTED_ROW_NO": {
    "name": "TABLE_SELECTED_ROW_NO",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Checks whether cells in one row contain an attribute value. Row numbers are zero-based in the helper loop.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_VERIFY_ANY_ROW_WITH_COLUMN_HAS_MATCH_REGEX": {
    "name": "TABLE_VERIFY_ANY_ROW_WITH_COLUMN_HAS_MATCH_REGEX",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Stores {Key}_firstrowmatched, {Key}_totalcount, {Key}_lastrowmatched. Supports datakeycolumnnumber, headertablexpath, headerhasth, rownumber, columnnumber.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_VERIFY_ATTRIBUTE_COLUMN_DIV_ICON": {
    "name": "TABLE_VERIFY_ATTRIBUTE_COLUMN_DIV_ICON",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Reads one icon attribute.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_VERIFY_CHECKBOX_CLASS": {
    "name": "TABLE_VERIFY_CHECKBOX_CLASS",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Uses GetValuesDictionary(Value).",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_VERIFY_CHECKBOXES_STATUS": {
    "name": "TABLE_VERIFY_CHECKBOXES_STATUS",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Value contains at least columnnumber.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_VERIFY_COLUMN_ANY_ICON_HAS_ATTRIBUTE_WITH_VALUE": {
    "name": "TABLE_VERIFY_COLUMN_ANY_ICON_HAS_ATTRIBUTE_WITH_VALUE",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Passes if any icon matches.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_VERIFY_COLUMN_DATA_HAS_DIV_ICON": {
    "name": "TABLE_VERIFY_COLUMN_DATA_HAS_DIV_ICON",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Checks for icons under the cell div.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_VERIFY_COLUMN_DATA_HAS_ICON": {
    "name": "TABLE_VERIFY_COLUMN_DATA_HAS_ICON",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Checks for i elements in the cell.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_VERIFY_COLUMN_DIV_HAS_STYLE": {
    "name": "TABLE_VERIFY_COLUMN_DIV_HAS_STYLE",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Checks whether a target cell div style contains a fragment.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_VERIFY_COLUMN_DIV_HAS_TAG": {
    "name": "TABLE_VERIFY_COLUMN_DIV_HAS_TAG",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Uses tag and optional divnumber.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_VERIFY_COLUMN_DIV_STYLE": {
    "name": "TABLE_VERIFY_COLUMN_DIV_STYLE",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Compares current style against stored style.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_VERIFY_COLUMN_HEADER_HAS_ICON": {
    "name": "TABLE_VERIFY_COLUMN_HEADER_HAS_ICON",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Header icon presence check.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_VERIFY_COLUMN_HEADER_HAS_ICON_WITH_CLASS_VALUE": {
    "name": "TABLE_VERIFY_COLUMN_HEADER_HAS_ICON_WITH_CLASS_VALUE",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Also validates icon class.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_VERIFY_COLUMN_ICON_HAS_ATTRIBUTE_WITH_VALUE": {
    "name": "TABLE_VERIFY_COLUMN_ICON_HAS_ATTRIBUTE_WITH_VALUE",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Verifies one icon attribute directly.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_VERIFY_COLUMN_STYLE": {
    "name": "TABLE_VERIFY_COLUMN_STYLE",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Present in the enum, but no runtime branch was found in the scanned execution path.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_VERIFY_COLUMN_VALUE_WITH_REGEX": {
    "name": "TABLE_VERIFY_COLUMN_VALUE_WITH_REGEX",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Value may include headertablexpath, headerhasth, rownumber, columnnumber. Without columnnumber, all columns are checked.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_VERIFY_HEADER_ROWS_COLUMN_DIV_TEXT": {
    "name": "TABLE_VERIFY_HEADER_ROWS_COLUMN_DIV_TEXT",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Reads one header-row div text and compares it to headertext.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_VERIFY_HEADERS_ROW_COLUMN_TEXT": {
    "name": "TABLE_VERIFY_HEADERS_ROW_COLUMN_TEXT",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Reads one header-row text cell and compares it to headertext.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_VERIFY_HEADERS_ROWS_COUNT": {
    "name": "TABLE_VERIFY_HEADERS_ROWS_COUNT",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Counts header rows.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_VERIFY_HEADERS_STYLE": {
    "name": "TABLE_VERIFY_HEADERS_STYLE",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Current logic only handles comparefor=currentdatemonthheader.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_VERIFY_ROW_COLUMN_DIV_TEXT_IN_DICTIONARY": {
    "name": "TABLE_VERIFY_ROW_COLUMN_DIV_TEXT_IN_DICTIONARY",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Compares one div text against a saved value.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_VERIFY_ROW_COLUMN_DIV_VALUE": {
    "name": "TABLE_VERIFY_ROW_COLUMN_DIV_VALUE",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "unused",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "optional",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_VERIFY_ROW_COLUMN_SPAN_TEXT_IN_DICTIONARY": {
    "name": "TABLE_VERIFY_ROW_COLUMN_SPAN_TEXT_IN_DICTIONARY",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Compares one span text against a saved value.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_VERIFY_SELECTED_ROW_COLUMN_HAS_ATTRIBUTE_WITH_VALUE": {
    "name": "TABLE_VERIFY_SELECTED_ROW_COLUMN_HAS_ATTRIBUTE_WITH_VALUE",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Works off selected rows.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_VERIFY_TEXT_BY_COLUMNS_DATA": {
    "name": "TABLE_VERIFY_TEXT_BY_COLUMNS_DATA",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Value must include headertablexpath, columnscount, repeated column{i}header, column{i}searchkey, and expectedrowcount.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_VERIFY_VISIBLE_AG_ROWS_COUNT": {
    "name": "TABLE_VERIFY_VISIBLE_AG_ROWS_COUNT",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Uses ag-grid row count.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_VERIFY_VISIBLE_ROWS_COUNT": {
    "name": "TABLE_VERIFY_VISIBLE_ROWS_COUNT",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Table and Grid Matrix)",
    "notes": "Compares current visible row count against Value.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TABLE_VERIFY_VISIBLE_ROWS_COUNT_CHANGE": {
    "name": "TABLE_VERIFY_VISIBLE_ROWS_COUNT_CHANGE",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Compares current visible row count to the saved count.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TOGGLE_CHECKBOX": {
    "name": "TOGGLE_CHECKBOX",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Iterates all checkbox labels under the current element XPath.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TOGGLE_PROJECTOR_MODE": {
    "name": "TOGGLE_PROJECTOR_MODE",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Toggles projector mode and optionally enters a password in a popup/frame. Copy a working example.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TOOL_TIP_COLOR": {
    "name": "TOOL_TIP_COLOR",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Compares GetCssValue(\"color\") to ExpectedValue.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TOOL_TIP_COMPARE_TABLE": {
    "name": "TOOL_TIP_COMPARE_TABLE",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Stable path is a concatenated compare using two headers and IsConcatenated=true. The tooltip lines are matched as SecondHeader, FirstHeader.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "optional"
    }
  },
  "TOOL_TIP_CONTAINS": {
    "name": "TOOL_TIP_CONTAINS",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Asserts the title attribute contains ExpectedValue.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TOOL_TIP_EQUAL": {
    "name": "TOOL_TIP_EQUAL",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Compares the title attribute exactly to ExpectedValue.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TRANSFER_BALANCE_TO_SIBLING": {
    "name": "TRANSFER_BALANCE_TO_SIBLING",
    "category": "business",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Deleted Items and Other Business-Specific Actions)",
    "notes": "Payment helper: fully driven by saved keys like Balance and SiblingFirstName1. Copy existing usage only.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TRIGGER_SQL_QUERY": {
    "name": "TRIGGER_SQL_QUERY",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Sends the query via HttpService using configured SQL credentials.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TYPE": {
    "name": "TYPE",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "If Key exists, stored data is typed instead of Value.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TYPE_DATE": {
    "name": "TYPE_DATE",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Enters DateTime.Now + Value in dd/MM/yyyy.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TYPE_DELAY": {
    "name": "TYPE_DELAY",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "If Key exists, stored data is typed instead of Value.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TYPE_INVISIBLE_ELEMENT": {
    "name": "TYPE_INVISIBLE_ELEMENT",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Uses JavaScript to assign value.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "TYPE_RANDOM_STRING": {
    "name": "TYPE_RANDOM_STRING",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "ExpectedValue controls alphabet/number/default random text.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "optional",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "UNCHECK_IF_CHECKED": {
    "name": "UNCHECK_IF_CHECKED",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Clicks the element only if it is currently checked.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "UNCHECKED": {
    "name": "UNCHECKED",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Uses element.Selected.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "UPDATE_DICTIONARY_KEY_VALUE": {
    "name": "UPDATE_DICTIONARY_KEY_VALUE",
    "category": "compare",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Dictionary, Comparison, and Calculation Actions)",
    "notes": "Supports datatype:string with dataoperation:append",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "UPLOAD_FILE": {
    "name": "UPLOAD_FILE",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "If Key exists, the stored path is used instead of Value.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VALIDATE_ACTIVE_DATE_FILTER": {
    "name": "VALIDATE_ACTIVE_DATE_FILTER",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "All dates in the named column must be later than the saved active date in Key.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VALIDATE_AGE": {
    "name": "VALIDATE_AGE",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Compares element text with Helpers.CalculateAge(Value).",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VALIDATE_AGE_NUMBER": {
    "name": "VALIDATE_AGE_NUMBER",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Compares element text with Helpers.CalculateAgeNumber(Value).",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VALIDATE_AGE_SHORT": {
    "name": "VALIDATE_AGE_SHORT",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Compares element text with Helpers.CalculateAgeShort(Value).",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VALIDATE_DATE_TIME_FORMAT": {
    "name": "VALIDATE_DATE_TIME_FORMAT",
    "category": "date",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Date and Time Matrix)",
    "notes": "Uses DateTime.GetDateTimeFormats()[Value].",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VALIDATE_LEAVERS": {
    "name": "VALIDATE_LEAVERS",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "All dates in the named column must be earlier than the saved date in Key.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VALIDATE_LIST_COUNT": {
    "name": "VALIDATE_LIST_COUNT",
    "category": "list",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (List Action Matrix)",
    "notes": "Current visible count must differ from stored count.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VALIDATE_SAVE_DROPDOWN_LIST_COUNT": {
    "name": "VALIDATE_SAVE_DROPDOWN_LIST_COUNT",
    "category": "list",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (List Action Matrix)",
    "notes": "Compares current dropdown count against stored count.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VALIDATE_STICKY_NODE_ADD": {
    "name": "VALIDATE_STICKY_NODE_ADD",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Value contains four paths: count, previous button, date control, text control. Headers contains expected text and date token like TODAY, YESTERDAY, TOMORROW.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VALIDATE_STUDENT_DELETED_SUCCESSFULLY": {
    "name": "VALIDATE_STUDENT_DELETED_SUCCESSFULLY",
    "category": "business",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Deleted Items and Other Business-Specific Actions)",
    "notes": "Student helper: checks saved student rows now exist in the deleted-student table.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VALUE_EXIST_IN_ALL_ITEMS_OF_LIST": {
    "name": "VALUE_EXIST_IN_ALL_ITEMS_OF_LIST",
    "category": "list",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (List Action Matrix)",
    "notes": "All items must contain ExpectedValue.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VALUE_EXIST_IN_LIST": {
    "name": "VALUE_EXIST_IN_LIST",
    "category": "list",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (List Action Matrix)",
    "notes": "If Value exists it overrides the assertion mode.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VERIFY_ACTUALS": {
    "name": "VERIFY_ACTUALS",
    "category": "date",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Date and Time Matrix)",
    "notes": "Specialized numeric sign comparison against stored value.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VERIFY_ALL_PERIODS_FOR_ROW": {
    "name": "VERIFY_ALL_PERIODS_FOR_ROW",
    "category": "attendance",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Attendance and Marks Actions)",
    "notes": "Uses Table.GetManageAttendanceRowMarkPeriodCount.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VERIFY_ATTENDANCE_MARK_COUNT_FOR_SELECTED_STUDENT": {
    "name": "VERIFY_ATTENDANCE_MARK_COUNT_FOR_SELECTED_STUDENT",
    "category": "attendance",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Attendance and Marks Actions)",
    "notes": "Uses Table.GetManageAttendanceRowCountForParticularColum(element, Headers).",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VERIFY_CANCEL_MARK": {
    "name": "VERIFY_CANCEL_MARK",
    "category": "attendance",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Attendance and Marks Actions)",
    "notes": "Compares current value to the previously saved mark in Key.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VERIFY_CLASS_EQUAL": {
    "name": "VERIFY_CLASS_EQUAL",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Value may contain \"OR\" to allow alternative class matches.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VERIFY_CR_DR": {
    "name": "VERIFY_CR_DR",
    "category": "date",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Date and Time Matrix)",
    "notes": "Converts a stored signed value into CR/DR text and compares to the element.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VERIFY_DATE": {
    "name": "VERIFY_DATE",
    "category": "date",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Date and Time Matrix)",
    "notes": "Headers must contain dd/MM/yyyy or dd/MM/yy.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "optional",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VERIFY_DATE_EQUAL_TO_CURRENT_DD_MM_YY": {
    "name": "VERIFY_DATE_EQUAL_TO_CURRENT_DD_MM_YY",
    "category": "date",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Date and Time Matrix)",
    "notes": "Uses current date in dd/MM/yy.",
    "contract": {
      "element": "optional",
      "elementCategory": "optional",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VERIFY_DELAY": {
    "name": "VERIFY_DELAY",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "In practice this only adds a 60-second XPath wait before normal element resolution. Use the same parameter shape as the non-delay version of the step.",
    "contract": {
      "element": "optional",
      "elementCategory": "optional",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VERIFY_DICTIONARY_KEY_VALUE": {
    "name": "VERIFY_DICTIONARY_KEY_VALUE",
    "category": "compare",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Dictionary, Comparison, and Calculation Actions)",
    "notes": "Compares DataStore[Key] to Value.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "optional",
      "expectedValue": "optional",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VERIFY_DYNAMIC_STRING": {
    "name": "VERIFY_DYNAMIC_STRING",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Replaces Datakey1, Datakey2 etc through CommonControls.AddDatakeyValueToString.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VERIFY_ELEMENT_TYPE_ATTRIBUTE": {
    "name": "VERIFY_ELEMENT_TYPE_ATTRIBUTE",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Compares type attribute.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VERIFY_ELEMENT_VALUE_EQUAL_CURRENT_DATE": {
    "name": "VERIFY_ELEMENT_VALUE_EQUAL_CURRENT_DATE",
    "category": "date",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (Date and Time Matrix)",
    "notes": "Uses current date in dd/MM/yyyy.",
    "contract": {
      "element": "optional",
      "elementCategory": "optional",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VERIFY_LIST_IS_SORTED": {
    "name": "VERIFY_LIST_IS_SORTED",
    "category": "list",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (List, Filter, and Sort Actions)",
    "notes": "Reads a saved list from DataStore and compares it to the sorted version.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "required",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VERIFY_PERCENTAGE_VALUE": {
    "name": "VERIFY_PERCENTAGE_VALUE",
    "category": "compare",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Dictionary, Comparison, and Calculation Actions)",
    "notes": "Calculates percentage from saved count and the total element at Headers, then checks current text contains that percentage.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "optional",
      "key": "required",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VERIFY_SELECT_LAST": {
    "name": "VERIFY_SELECT_LAST",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Uses Table.GetSelectedItems and compares the selected values in column Headers to the saved values from Key.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "not-used",
      "expectedValue": "not-used",
      "key": "required",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VERIFY_SELECT_OPTIONS_DISPLAYTEXT": {
    "name": "VERIFY_SELECT_OPTIONS_DISPLAYTEXT",
    "category": "browser",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Generic and Browser Actions)",
    "notes": "Every non-empty entry in Value must exist as a visible option.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VERIFY_SELECTED_COLUMN_VALUE_WITH_ELEMENT_TEXT": {
    "name": "VERIFY_SELECTED_COLUMN_VALUE_WITH_ELEMENT_TEXT",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Reads a selected-row dictionary from Key and checks whether the current element text contains each saved value from column Value.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "required",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VERIFY_SELECTED_LIST_ITEM_COUNT": {
    "name": "VERIFY_SELECTED_LIST_ITEM_COUNT",
    "category": "list",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (List Action Matrix)",
    "notes": "Defaults to 5 if empty.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VERIFY_SELECTED_RADIO_BUTTON": {
    "name": "VERIFY_SELECTED_RADIO_BUTTON",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Uses RadioControl and group name from Value.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VERIFY_STYLE": {
    "name": "VERIFY_STYLE",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Checks whether style contains Value.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VERIFY_STYLE_EQUAL": {
    "name": "VERIFY_STYLE_EQUAL",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Value is not the final assertion here; ExpectedValue is.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VERIFY_TABLE_COLUMN_ATTRIBUTE": {
    "name": "VERIFY_TABLE_COLUMN_ATTRIBUTE",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Looks in the second-last column div for an attribute that contains findvalue.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VERIFY_TABLE_COLUMN_DATA_CONTAINS": {
    "name": "VERIFY_TABLE_COLUMN_DATA_CONTAINS",
    "category": "table",
    "description": "Defined in ACTION_PARAMETER_APPENDIX.md (Table and Grid Actions)",
    "notes": "Reads a saved table dictionary and checks whether any value in the named column contains Value.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "required",
      "expectedValue": "optional",
      "key": "required",
      "headers": "required",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VERIFY_XML_TAG": {
    "name": "VERIFY_XML_TAG",
    "category": "xml",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (XML and File Matrix)",
    "notes": "Headers contains parent tag and optional child tag.",
    "contract": {
      "element": "optional",
      "elementCategory": "optional",
      "value": "optional",
      "expectedValue": "optional",
      "key": "optional",
      "headers": "optional",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "VERIFYDATA": {
    "name": "VERIFYDATA",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Usually compares current element text against stored value.",
    "contract": {
      "element": "required",
      "elementCategory": "required",
      "value": "optional",
      "expectedValue": "optional",
      "key": "optional",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "ZOOM_IN_OUT": {
    "name": "ZOOM_IN_OUT",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Executes document.body.style.scale = Value.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  },
  "ZOOM_IN": {
    "name": "ZOOM_IN",
    "category": "element",
    "description": "Defined in ACTION_PARAMETER_MATRIX.md (High-Confidence Action Matrix)",
    "notes": "Executes document.body.style.scale = Value.",
    "contract": {
      "element": "not-used",
      "elementCategory": "not-used",
      "value": "optional",
      "expectedValue": "not-used",
      "key": "not-used",
      "headers": "not-used",
      "elementReplaceTextDataKey": "optional",
      "isElementPathDynamic": "optional",
      "isConcatenated": "not-used"
    }
  }
} as const;
