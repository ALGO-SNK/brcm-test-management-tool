interface IconProps {
  size?: number;
  className?: string;
  filled?: boolean;
}

interface MaterialIconProps extends IconProps {
  name: string;
}

function MaterialIcon({ name, size = 18, className, filled = false }: MaterialIconProps) {
  return (
    <span
      className={`app-icon material-symbols-rounded${filled ? ' app-icon--filled' : ''}${className ? ` ${className}` : ''}`}
      style={{ fontSize: `${size}px`, width: `${size}px`, height: `${size}px` }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

export function IconRefresh(props: IconProps) {
  return <MaterialIcon name="refresh" {...props} />;
}

export function IconSettings(props: IconProps) {
  return <MaterialIcon name="settings" {...props} />;
}

export function IconHelp(props: IconProps) {
  return <MaterialIcon name="help" {...props} />;
}

export function IconArrowRight(props: IconProps) {
  return <MaterialIcon name="arrow_forward" {...props} />;
}

export function IconArrowUpward(props: IconProps) {
  return <MaterialIcon name="arrow_upward" {...props} />;
}

export function IconArrowDownward(props: IconProps) {
  return <MaterialIcon name="arrow_downward" {...props} />;
}

export function IconSave(props: IconProps) {
  return <MaterialIcon name="save" {...props} />;
}

export function IconCopy(props: IconProps) {
  return <MaterialIcon name="content_copy" {...props} />;
}

export function IconPlus(props: IconProps) {
  return <MaterialIcon name="add" {...props} />;
}

export function IconTune(props: IconProps) {
  return <MaterialIcon name="tune" {...props} />;
}

export function IconX(props: IconProps) {
  return <MaterialIcon name="close" {...props} />;
}

export function IconChevronRight(props: IconProps) {
  return <MaterialIcon name="chevron_right" {...props} />;
}

export function IconSearch(props: IconProps) {
  return <MaterialIcon name="search" {...props} />;
}

export function IconVisibility(props: IconProps) {
  return <MaterialIcon name="visibility" {...props} />;
}

export function IconDescription(props: IconProps) {
  return <MaterialIcon name="description" {...props} />;
}

export function IconEdit(props: IconProps) {
  return <MaterialIcon name="edit" {...props} />;
}

export function IconDelete(props: IconProps) {
  return <MaterialIcon name="delete" {...props} />;
}

export function IconCheckCircle(props: IconProps) {
  return <MaterialIcon name="check_circle" {...props} />;
}

export function IconInfo(props: IconProps) {
  return <MaterialIcon name="info" {...props} />;
}

export function IconWarning(props: IconProps) {
  return <MaterialIcon name="warning" {...props} />;
}

export function IconError(props: IconProps) {
  return <MaterialIcon name="error" {...props} />;
}

export function IconChevronDown(props: IconProps) {
  return <MaterialIcon name="expand_more" {...props} />;
}

export function IconFolder(props: IconProps) {
  return <MaterialIcon name="folder" {...props} />;
}

export function IconFolderOpen(props: IconProps) {
  return <MaterialIcon name="folder_open" {...props} />;
}

export function IconCreateNewFolder(props: IconProps) {
  return <MaterialIcon name="create_new_folder" {...props} />;
}

export function IconFilterList(props: IconProps) {
  return <MaterialIcon name="filter_list" {...props} />;
}

export function IconUnfoldMore(props: IconProps) {
  return <MaterialIcon name="unfold_more" {...props} />;
}

export function IconSort(props: IconProps) {
  return <MaterialIcon name="height" {...props} />;
}

export function IconUnfoldLess(props: IconProps) {
  return <MaterialIcon name="unfold_less" {...props} />;
}

export function IconMoreHoriz(props: IconProps) {
  return <MaterialIcon name="more_horiz" {...props} />;
}

export function IconOpenInNew(props: IconProps) {
  return <MaterialIcon name="open_in_new" {...props} />;
}
