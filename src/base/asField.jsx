import React from 'react';
import PropTypes from 'prop-types';
import { getValidateText } from './validate';
import { isHidden, isDependShow } from './isHidden';
import {
  evaluateString,
  isLooselyNumber,
  isCssLength,
  isFunction,
} from './utils';

// asField拆分成逻辑组件和展示组件，从而可替换展示组件的方式完全插拔fr的样式
export const asField = ({ FieldUI, Widget }) => {
  let FieldContainer = ({
    className,
    column,
    showValidate,
    isRoot,
    hidden,
    props,
    showDescIcon,
    width,
    labelWidth,
    disabled,
    readonly,
    options,
    schema,
    ...rest
  }) => {
    const { displayType, rootValue = {}, formData = {}, dependShow } = rest;
    // most key of schema, disabled, readonly, options, hidden, support for function expression
    const convertValue = item => {
      if (typeof item === 'function') {
        return item(formData, rootValue);
      } else if (typeof item === 'string' && isFunction(item) !== false) {
        const _item = isFunction(item);
        try {
          return evaluateString(_item, formData, rootValue);
        } catch (error) {
          console.error(error.message);
          console.error(`happen at ${item}`);
          return item;
        }
      }
      return item;
    };

    hidden = convertValue(hidden);
    disabled = convertValue(disabled);
    readonly = convertValue(readonly);
    options = convertValue(options);
    // iterate over schema, and convert every key
    let _schema = { ...schema };
    Object.keys(schema).forEach(key => {
      const availableKey = [
        'title',
        'description',
        'format',
        'pattern',
        'message',
        'min',
        'max',
        'step',
        'enum',
        'enumNames',
      ];
      // TODO: need to cover more
      if (availableKey.indexOf(key) > -1) {
        _schema[key] = convertValue(schema[key]);
      }
    });

    // "ui:hidden": true, hide formItem
    // after "convertValue" being stable, this api will be discarded
    if (hidden && isHidden({ hidden, rootValue, formData })) {
      return null;
    }

    // 传入组件的值
    const _rest = {
      ...rest,
      schema: _schema,
      disabled,
      readonly,
      options,
      formData: formData || {},
      rootValue: rootValue || {},
    };

    // 不建议使用ui:dependShow, 一般一律使用ui:hidden。ui:dependShow可以做复杂、跨结构的校验
    if (isDependShow({ formData, dependShow })) {
      return null;
    }

    let isComplex =
      _schema.type === 'object' ||
      (_schema.type === 'array' && _schema.enum === undefined);
    const isModal = options && (options.modal || options.drawer);
    if (isModal) {
      isComplex = false;
    }

    const validateText = getValidateText(_rest);
    // 必填*，label，描述，竖排时的校验语，只要存在一个，label就不为空
    const showLabel =
      _schema.title ||
      rest.description ||
      rest.required ||
      (displayType !== 'row' && showValidate && validateText);

    let columnStyle = {};
    if (!isComplex && width) {
      columnStyle = {
        width,
        paddingRight: '12px',
      };
    } else if (!isComplex && column > 1) {
      columnStyle = {
        width: `calc(100% /${column})`,
        paddingRight: '12px',
      };
    }

    const fieldProps = {
      className,
      columnStyle,
      displayType,
      isComplex,
      isRequired: rest.required,
      isRoot,
      schema: _schema,
      showDescIcon,
      showLabel,
      showValidate,
      validateText,
      labelWidth,
    };
    return (
      <FieldUI {...fieldProps}>
        <Widget {..._rest} invalid={showValidate && validateText} />
      </FieldUI>
    );
  };
  FieldContainer.propTypes = {
    showValidate: PropTypes.bool,
    column: PropTypes.number,
    isRoot: PropTypes.bool,
    props: PropTypes.object,
    showDescIcon: PropTypes.bool,
    displayType: PropTypes.string,
  };

  FieldContainer.defaultProps = {
    showValidate: true,
    column: 1,
    isRoot: false,
    props: {},
    showDescIcon: false,
    displayType: 'column',
  };

  return FieldContainer;
};

export const DefaultFieldUI = ({
  children,
  className,
  columnStyle, // 处理组件宽度，外部一般不需修改
  displayType, // 展示方式：row 横 column 竖
  isComplex, // 是否是复杂结构：对象和对象数组
  isRequired, // 是否是必填项
  isRoot,
  schema,
  showDescIcon,
  showLabel, // 是否展示label
  showValidate, // 是否展示校验
  validateText, // 校验文字
  labelWidth, // label的长度
}) => {
  // field 整体 label 标签 content 内容
  const {
    title,
    type,
    enum: _enum,
    description = '',
    'ui:widget': widget,
    'ui:options': options,
  } = schema;
  const isCheckbox = type === 'boolean' && widget !== 'switch';
  const isModal = options && (options.modal || options.drawer);
  let fieldClass = `fr-field w-100 ${isComplex ? 'fr-field-complex' : ''}`;
  let labelClass = 'fr-label mb2';
  let contentClass = 'fr-content';
  switch (type) {
    case 'object':
      if (isModal) {
        break;
      }
      if (title) {
        labelClass += ' fr-label-object bb b--black-20 pb1 mt2 mb3'; // fr-label-object 无默认style，只是占位用于使用者样式覆盖
      }
      if (!isRoot) {
        fieldClass += ' fr-field-object'; // object的margin bottom由内部元素撑起
        if (title) {
          contentClass += ' ml3'; // 缩进
        }
      }
      break;
    case 'array':
      if (isModal) {
        break;
      }
      if (title && !_enum) {
        labelClass += ' fr-label-array mt2 mb3';
      }
      break;
    case 'boolean':
      if (isCheckbox) {
        if (title) {
          labelClass += ' ml2';
          labelClass = labelClass.replace('mb2', 'mb0');
        }
        contentClass += ' flex items-center'; // checkbox高度短，需要居中对齐
        fieldClass += ' flex items-center flex-row-reverse justify-end';
      }
      break;
    default:
      if (displayType === 'row') {
        labelClass = labelClass.replace('mb2', 'mb0');
      }
  }
  // 横排时
  if (displayType === 'row' && !isComplex && !isCheckbox) {
    fieldClass += ' flex items-center';
    labelClass += ' flex-shrink-0 fr-label-row';
    labelClass = labelClass.replace('mb2', 'mb0');
    contentClass += ' flex-grow-1 relative';
  }

  // 横排的checkbox
  if (displayType === 'row' && isCheckbox) {
    contentClass += ' flex justify-end pr2';
  }

  const _labelWidth = isLooselyNumber(labelWidth)
    ? Number(labelWidth)
    : isCssLength(labelWidth)
    ? labelWidth
    : 110; // 默认是 110px 的长度
  let labelStyle = { width: _labelWidth };
  if (isCheckbox) {
    labelStyle = { flexGrow: 1 };
  } else if (isComplex || displayType === 'column') {
    labelStyle = { flexGrow: 1 };
  }

  return (
    <div
      className={className ? `${className} ${fieldClass}` : fieldClass}
      style={columnStyle}
    >
      {showLabel && (
        <div className={labelClass} style={labelStyle}>
          <label
            className={`fr-label-title ${
              isCheckbox || displayType === 'column' ? 'no-colon' : ''
            }`} // boolean不带冒号
            title={title}
          >
            {isRequired && <span className="fr-label-required"> *</span>}
            <span
              className={`${isComplex ? 'b' : ''} ${
                displayType === 'column' ? 'flex-none' : ''
              }`}
            >
              {title}
            </span>
            {description &&
              (showDescIcon ? (
                <span className="fr-tooltip-toggle" aria-label={description}>
                  <i className="fr-tooltip-icon" />
                  <div className="fr-tooltip-container">
                    <i className="fr-tooltip-triangle" />
                    {description}
                  </div>
                </span>
              ) : (
                <span className="fr-desc ml2">(&nbsp;{description}&nbsp;)</span>
              ))}
            {displayType !== 'row' && showValidate && validateText && (
              <span className="fr-validate">{validateText}</span>
            )}
          </label>
        </div>
      )}
      <div
        className={contentClass}
        style={
          isCheckbox
            ? displayType === 'row'
              ? { marginLeft: _labelWidth }
              : {}
            : { flexGrow: 1 }
        }
      >
        <div className={`flex ${isComplex ? 'flex-column' : 'items-center'}`}>
          {children}
        </div>
        {displayType === 'row' && showValidate && validateText && (
          <span
            className={`fr-validate fr-validate-row ${
              isComplex ? 'relative' : 'absolute'
            }`}
          >
            {validateText}
          </span>
        )}
      </div>
    </div>
  );
};
