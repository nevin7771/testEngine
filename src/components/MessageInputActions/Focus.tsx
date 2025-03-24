import {
  BadgePercent,
  ChevronDown,
  Code,
  FileText,
  Globe,
  ScanEye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from '@headlessui/react';
import { Fragment, useState } from 'react';

const agentModes = [
  {
    key: 'generalAgent',
    title: 'General Agent',
    description: 'Searches Zoom Support, Community, and web',
    icon: <Globe size={20} />,
  },
  {
    key: 'jiraAgent',
    title: 'JIRA Agent',
    description: 'Analyzes JIRA tickets and provides solutions',
    icon: <Code size={20} />,
  },
  {
    key: 'logAnalyzerAgent',
    title: 'Client Log Analyzer',
    description: 'Analyzes client logs to identify issues',
    icon: <FileText size={20} />,
  },
];

const Focus = ({
  focusModes,
  setFocusModes,
}: {
  focusModes: string[];
  setFocusModes: (modes: string[]) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMode = (mode: string) => {
    if (focusModes.includes(mode)) {
      setFocusModes(focusModes.filter((m) => m !== mode));
    } else {
      setFocusModes([...focusModes, mode]);
    }
  };

  // Get active modes title for display
  const getActiveModeTitle = () => {
    if (focusModes.length === 0) return "General Agent";
    if (focusModes.length === 1) {
      return agentModes.find(mode => mode.key === focusModes[0])?.title || "Agent";
    }
    return `${focusModes.length} Agents`;
  };

  return (
    <Popover className="relative w-full max-w-[15rem] md:max-w-md lg:max-w-lg mt-[6.5px]">
      {({ open }) => (
        <>
          <PopoverButton
            type="button"
            className="text-black/50 dark:text-white/50 rounded-xl hover:bg-light-secondary dark:hover:bg-dark-secondary active:scale-95 transition duration-200 hover:text-black dark:hover:text-white"
            onClick={() => setIsOpen(!isOpen)}
          >
            <div className="flex flex-row items-center space-x-1">
              <ScanEye size={20} />
              <p className="text-xs font-medium hidden lg:block">
                {getActiveModeTitle()}
              </p>
              <ChevronDown size={20} className="-translate-x-1" />
            </div>
          </PopoverButton>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-150"
            enterFrom="opacity-0 translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-1"
            show={open}
          >
            <PopoverPanel className="absolute z-10 w-64 md:w-[500px] left-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 bg-light-primary dark:bg-dark-primary border rounded-lg border-light-200 dark:border-dark-200 w-full p-4 max-h-[200px] md:max-h-none overflow-y-auto">
                {agentModes.map((mode, i) => (
                  <div
                    onClick={() => toggleMode(mode.key)}
                    key={i}
                    className={cn(
                      'p-2 rounded-lg flex flex-col items-start justify-start text-start space-y-2 duration-200 cursor-pointer transition',
                      focusModes.includes(mode.key)
                        ? 'bg-light-secondary dark:bg-dark-secondary'
                        : 'hover:bg-light-secondary dark:hover:bg-dark-secondary',
                    )}
                  >
                    <div className="flex flex-row items-center space-x-1">
                      <div className={cn(
                        focusModes.includes(mode.key)
                          ? 'text-[#24A0ED]'
                          : 'text-black dark:text-white'
                      )}>
                        {mode.icon}
                      </div>
                      <div className="flex flex-row items-center">
                        <p className={cn(
                          "text-sm font-medium",
                          focusModes.includes(mode.key)
                            ? 'text-[#24A0ED]'
                            : 'text-black dark:text-white'
                        )}>
                          {mode.title}
                        </p>
                        {focusModes.includes(mode.key) && (
                          <div className="ml-2 w-4 h-4 bg-[#24A0ED] rounded-full flex items-center justify-center">
                            <span className="text-white text-xs">✓</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-black/70 dark:text-white/70 text-xs">
                      {mode.description}
                    </p>
                  </div>
                ))}
              </div>
            </PopoverPanel>
          </Transition>
        </>
      )}
    </Popover>
  );
};

export default Focus;